import { normalizeImage } from '../../common/image-upload';
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

import { FridgeItem, StorageType } from '../../database/entities/fridge-item.entity';
import { ScanSession, ScanStatus } from '../../database/entities/scan-session.entity';
import { Ingredient } from '../../database/entities/ingredient.entity';
import { Recipe } from '../../database/entities/recipe.entity';
import { RecipeIngredient } from '../../database/entities/recipe-ingredient.entity';

import { GetFridgeItemsDto, FridgeStorageFilter, FridgeSortOrder } from './dto/get-fridge-items.dto';
import { AddFridgeItemDto } from './dto/add-fridge-item.dto';
import { UpdateFridgeItemDto } from './dto/update-fridge-item.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { ConfirmScanDto } from './dto/confirm-scan.dto';
import { DeductIngredientsDto } from './dto/deduct-ingredients.dto';

interface FreshnessResult {
  score: number;
  label: 'fresh' | 'good' | 'expiring_soon' | 'expired';
}

const DEFAULT_FRIDGE_ITEMS: Array<{
  customName: string;
  quantity: number;
  unit: string;
  storageType: StorageType;
  daysLeft: number;
}> = [
  { customName: 'Baby Spinach',     quantity: 200,  unit: 'g',   storageType: StorageType.FRIDGE,  daysLeft: 1 },
  { customName: 'Whole Milk',       quantity: 1200, unit: 'ml',  storageType: StorageType.FRIDGE,  daysLeft: 2 },
  { customName: 'Salmon Fillet',    quantity: 350,  unit: 'g',   storageType: StorageType.FRIDGE,  daysLeft: 2 },
  { customName: 'Fresh Pesto',      quantity: 190,  unit: 'g',   storageType: StorageType.FRIDGE,  daysLeft: 3 },
  { customName: 'Avocados',         quantity: 2,    unit: 'pcs', storageType: StorageType.FRIDGE,  daysLeft: 4 },
  { customName: 'Greek Yogurt',     quantity: 500,  unit: 'ml',  storageType: StorageType.FRIDGE,  daysLeft: 5 },
  { customName: 'Large Brown Eggs', quantity: 8,    unit: 'pcs', storageType: StorageType.FRIDGE,  daysLeft: 7 },
  { customName: 'Garlic',           quantity: 6,    unit: 'pcs', storageType: StorageType.PANTRY,  daysLeft: 21 },
  { customName: 'Dumplings',        quantity: 20,   unit: 'pcs', storageType: StorageType.FREEZER, daysLeft: 45 },
  { customName: 'Chicken Breast',   quantity: 400,  unit: 'g',   storageType: StorageType.FRIDGE,  daysLeft: 4 },
  { customName: 'Olive Oil',        quantity: 250,  unit: 'ml',  storageType: StorageType.PANTRY,  daysLeft: 180 },
  { customName: 'White Rice',       quantity: 500,  unit: 'g',   storageType: StorageType.PANTRY,  daysLeft: 180 },
  { customName: 'Cherry Tomatoes',  quantity: 250,  unit: 'g',   storageType: StorageType.FRIDGE,  daysLeft: 5 },
  { customName: 'Cheddar Cheese',   quantity: 180,  unit: 'g',   storageType: StorageType.FRIDGE,  daysLeft: 10 },
];

@Injectable()
export class FridgeService {
  private readonly s3: S3Client;
  private readonly s3Bucket: string;
  private readonly s3Region: string;

  constructor(
    @InjectRepository(FridgeItem)
    private readonly fridgeItemRepo: Repository<FridgeItem>,

    @InjectRepository(ScanSession)
    private readonly scanSessionRepo: Repository<ScanSession>,

    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,

    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,

    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepo: Repository<RecipeIngredient>,

    @InjectQueue('fridge-scan')
    private readonly fridgeScanQueue: Queue,

    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.s3Bucket = this.configService.get<string>('aws.s3Bucket') ?? 'friyo-uploads';
    this.s3Region = this.configService.get<string>('aws.region') ?? 'us-east-1';
    this.s3 = new S3Client({
      region: this.s3Region,
      credentials: {
        accessKeyId: this.configService.get<string>('aws.accessKeyId') ?? '',
        secretAccessKey: this.configService.get<string>('aws.secretAccessKey') ?? '',
      },
    });
  }

  // ── GET /fridge ────────────────────────────────────────────────────────────

  async getFridgeItems(userId: string, query: GetFridgeItemsDto) {
    await this.ensureDefaultFridgeItems(userId);

    const qb = this.fridgeItemRepo
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.ingredient', 'ing')
      .where('fi.userId = :userId', { userId });

    if (query.storage_type && query.storage_type !== FridgeStorageFilter.ALL) {
      qb.andWhere('fi.storageType = :storageType', { storageType: query.storage_type as string as StorageType });
    }

    if (query.search) {
      qb.andWhere(
        '(fi.customName ILIKE :search OR ing.name ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.tag) {
      // simple-json tags stored as JSON text, e.g. '["vegetable","protein"]'
      qb.andWhere("ing.tags LIKE :tagPattern", { tagPattern: `%"${query.tag}"%` });
    }

    switch (query.sort) {
      case FridgeSortOrder.NAME:
        qb.orderBy('COALESCE(fi.customName, ing.name)', 'ASC');
        break;
      case FridgeSortOrder.ADDED_DATE:
        qb.orderBy('fi.addedAt', 'DESC');
        break;
      default:
        qb.orderBy('fi.expiryDate', 'ASC', 'NULLS LAST');
    }

    const items = await qb.getMany();
    return items.map(item => this.toFridgeItemResponse(item));
  }

  // ── POST /fridge/items ─────────────────────────────────────────────────────

  async addItem(userId: string, dto: AddFridgeItemDto) {
    const item = this.fridgeItemRepo.create({
      userId,
      ingredientId: dto.ingredient_id ?? null,
      customName: dto.custom_name,
      quantity: dto.quantity,
      unit: dto.unit ?? null,
      storageType: dto.storage_type,
      expiryDate: dto.expiry_date ? new Date(dto.expiry_date) : null,
      caloriesOverride: dto.calories_override ?? null,
    });

    const saved = await this.fridgeItemRepo.save(item);
    const withRelations = await this.fridgeItemRepo.findOne({
      where: { id: saved.id },
      relations: ['ingredient'],
    });
    return this.toFridgeItemResponse(withRelations!);
  }

  // ── PATCH /fridge/items/:id ────────────────────────────────────────────────

  async updateItem(userId: string, itemId: string, dto: UpdateFridgeItemDto) {
    const item = await this.findOwnedItem(userId, itemId);

    if (dto.custom_name !== undefined) item.customName = dto.custom_name;
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unit !== undefined) item.unit = dto.unit;
    if (dto.storage_type !== undefined) item.storageType = dto.storage_type;
    if (dto.expiry_date !== undefined) {
      item.expiryDate = dto.expiry_date ? new Date(dto.expiry_date) : null;
    }

    const saved = await this.fridgeItemRepo.save(item);
    const withRelations = await this.fridgeItemRepo.findOne({
      where: { id: saved.id },
      relations: ['ingredient'],
    });
    return this.toFridgeItemResponse(withRelations!);
  }

  // ── DELETE /fridge/items/:id ───────────────────────────────────────────────

  async deleteItem(userId: string, itemId: string): Promise<void> {
    const item = await this.findOwnedItem(userId, itemId);
    await this.fridgeItemRepo.remove(item);
  }

  // ── DELETE /fridge/items (bulk) ────────────────────────────────────────────

  async bulkDeleteItems(userId: string, dto: BulkDeleteDto): Promise<{ deleted: number }> {
    const items = await this.fridgeItemRepo.find({
      where: { id: In(dto.ids), userId },
    });

    if (items.length === 0) {
      throw new NotFoundException('No matching fridge items found');
    }

    // Reject if any id doesn't belong to the user
    if (items.length !== dto.ids.length) {
      const foundIds = new Set(items.map(i => i.id));
      const missing = dto.ids.filter(id => !foundIds.has(id));
      throw new ForbiddenException(`Items not found or not owned: ${missing.join(', ')}`);
    }

    await this.fridgeItemRepo.remove(items);
    return { deleted: items.length };
  }

  // ── POST /fridge/scan ──────────────────────────────────────────────────────

  async startScan(userId: string, file: Express.Multer.File) {
    file = await normalizeImage(file);

    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const timestamp = Date.now();
    const imageKey = `fridge-scans/${userId}/${timestamp}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: imageKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const imageUrl = `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${imageKey}`;

    const session = this.scanSessionRepo.create({
      userId,
      imageUrl,
      status: ScanStatus.PROCESSING,
    });
    const savedSession = await this.scanSessionRepo.save(session);

    await this.fridgeScanQueue.add(
      'fridge.scan',
      { sessionId: savedSession.id, imageKey, imageUrl, userId },
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
    );

    return { session_id: savedSession.id, status: ScanStatus.PROCESSING };
  }

  // ── GET /fridge/scan/:sessionId ────────────────────────────────────────────

  async getScanStatus(userId: string, sessionId: string) {
    const session = await this.scanSessionRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Scan session not found');

    const rawResult = session.aiRawResult as Record<string, unknown> | null;
    const detectedItems = rawResult?.['detected'] ?? [];

    return {
      session_id: session.id,
      status: session.status,
      items: detectedItems,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    };
  }

  // ── POST /fridge/scan/:sessionId/confirm ───────────────────────────────────

  async confirmScan(userId: string, sessionId: string, dto: ConfirmScanDto) {
    const session = await this.scanSessionRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Scan session not found');
    if (session.status !== ScanStatus.COMPLETED) {
      const rawResult = session.aiRawResult as Record<string, unknown> | null;
      const detectedItems = rawResult?.['detected'];
      if (!Array.isArray(detectedItems) || detectedItems.length === 0) {
        throw new BadRequestException('Scan session is not yet completed');
      }
      await this.scanSessionRepo.update(sessionId, { status: ScanStatus.COMPLETED });
    }

    const items = await this.dataSource.transaction(async (manager) => {
      const created: FridgeItem[] = [];
      for (const scanItem of dto.items) {
        const item = manager.create(FridgeItem, {
          userId,
          scanSessionId: sessionId,
          ingredientId: scanItem.ingredient_id ?? null,
          customName: scanItem.custom_name,
          quantity: scanItem.quantity,
          unit: scanItem.unit ?? null,
          storageType: scanItem.storage_type,
          expiryDate: scanItem.expiry_date ? new Date(scanItem.expiry_date) : null,
        });
        created.push(await manager.save(FridgeItem, item));
      }
      return created;
    });

    const withRelations = await this.fridgeItemRepo.find({
      where: { id: In(items.map(i => i.id)) },
      relations: ['ingredient'],
    });
    return withRelations.map(item => this.toFridgeItemResponse(item));
  }

  // ── POST /fridge/deduct ────────────────────────────────────────────────────

  async deductIngredients(userId: string, dto: DeductIngredientsDto) {
    const recipe = await this.recipeRepo.findOne({ where: { id: dto.recipe_id } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const recipeIngredients = await this.recipeIngredientRepo.find({
      where: { recipeId: dto.recipe_id },
    });

    const scale = dto.servings_used / (recipe.servings || 1);
    const deductionLog: { ingredient_id: string; deducted: number; unit: string | null }[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const ri of recipeIngredients) {
        if (!ri.ingredientId || !ri.quantity) continue;

        const deductAmount = Number(ri.quantity) * scale;
        const fridgeItems = await manager.find(FridgeItem, {
          where: { userId, ingredientId: ri.ingredientId },
          order: { addedAt: 'ASC' },
        });

        let remaining = deductAmount;
        for (const fi of fridgeItems) {
          if (remaining <= 0) break;
          const current = Number(fi.quantity);
          if (current <= remaining) {
            remaining -= current;
            await manager.remove(FridgeItem, fi);
          } else {
            fi.quantity = current - remaining;
            remaining = 0;
            await manager.save(FridgeItem, fi);
          }
        }

        deductionLog.push({
          ingredient_id: ri.ingredientId,
          deducted: deductAmount - Math.max(0, remaining),
          unit: ri.unit,
        });
      }
    });

    return { recipe_id: dto.recipe_id, servings_used: dto.servings_used, deductions: deductionLog };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async ensureDefaultFridgeItems(userId: string): Promise<void> {
    const existing = await this.fridgeItemRepo.find({
      where: { userId },
      select: ['customName'],
    });
    const existingNames = new Set(
      existing
        .map(item => item.customName?.trim().toLowerCase())
        .filter(Boolean) as string[],
    );

    const today = new Date();
    const items = DEFAULT_FRIDGE_ITEMS.filter(
      seed => !existingNames.has(seed.customName.toLowerCase()),
    ).map(seed => {
      const expiry = new Date(today);
      expiry.setDate(today.getDate() + seed.daysLeft);
      return this.fridgeItemRepo.create({
        userId,
        ingredientId: null,
        customName: seed.customName,
        quantity: seed.quantity,
        unit: seed.unit,
        storageType: seed.storageType,
        expiryDate: expiry,
        caloriesOverride: null,
      });
    });

    if (items.length === 0) return;
    await this.fridgeItemRepo.save(items);
  }

  private async findOwnedItem(userId: string, itemId: string): Promise<FridgeItem> {
    const item = await this.fridgeItemRepo.findOne({
      where: { id: itemId },
      relations: ['ingredient'],
    });
    if (!item) throw new NotFoundException('Fridge item not found');
    if (item.userId !== userId) throw new ForbiddenException('Access denied');
    return item;
  }

  private computeFreshness(expiryDate: Date | null): FreshnessResult {
    if (!expiryDate) return { score: 80, label: 'good' };
    const daysLeft = Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / 86_400_000,
    );
    if (daysLeft <= 0) return { score: 0, label: 'expired' };
    if (daysLeft <= 2) return { score: 20, label: 'expiring_soon' };
    if (daysLeft <= 7) return { score: 60, label: 'good' };
    return { score: 100, label: 'fresh' };
  }

  private toFridgeItemResponse(item: FridgeItem) {
    const { score, label } = this.computeFreshness(item.expiryDate);
    const daysUntilExpiry = item.expiryDate
      ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / 86_400_000)
      : null;

    return {
      id: item.id,
      ingredient_id: item.ingredientId,
      custom_name: item.customName ?? item.ingredient?.name ?? null,
      quantity: Number(item.quantity),
      unit: item.unit ?? item.ingredient?.unit ?? null,
      storage_type: item.storageType,
      expiry_date: item.expiryDate,
      calories_override: item.caloriesOverride !== null ? Number(item.caloriesOverride) : null,
      scan_session_id: item.scanSessionId,
      added_at: item.addedAt,
      updated_at: item.updatedAt,
      ingredient: item.ingredient
        ? {
            id: item.ingredient.id,
            name: item.ingredient.name,
            name_zh: item.ingredient.nameZh,
            category: item.ingredient.category,
            calories_per_100g: item.ingredient.caloriesPer100g !== null
              ? Number(item.ingredient.caloriesPer100g)
              : null,
            image_url: item.ingredient.imageUrl,
          }
        : null,
      freshness_score: score,
      freshness_label: label,
      days_until_expiry: daysUntilExpiry,
    };
  }
}
