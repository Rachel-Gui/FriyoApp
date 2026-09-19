import { imageUploadLimits } from '../../common/image-upload';
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

import { FridgeService } from './fridge.service';
import { GetFridgeItemsDto } from './dto/get-fridge-items.dto';
import { AddFridgeItemDto } from './dto/add-fridge-item.dto';
import { UpdateFridgeItemDto } from './dto/update-fridge-item.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { ConfirmScanDto } from './dto/confirm-scan.dto';
import { DeductIngredientsDto } from './dto/deduct-ingredients.dto';

@ApiTags('fridge')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('fridge')
export class FridgeController {
  constructor(private readonly fridgeService: FridgeService) {}

  // ── GET /fridge ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get all fridge items for the current user' })
  getFridgeItems(
    @CurrentUser() user: User,
    @Query() query: GetFridgeItemsDto,
  ) {
    return this.fridgeService.getFridgeItems(user.id, query);
  }

  // ── POST /fridge/items ─────────────────────────────────────────────────────

  @Post('items')
  @ApiOperation({ summary: 'Manually add a fridge item' })
  addItem(
    @CurrentUser() user: User,
    @Body() dto: AddFridgeItemDto,
  ) {
    return this.fridgeService.addItem(user.id, dto);
  }

  // ── PATCH /fridge/items/:id ────────────────────────────────────────────────

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update a fridge item' })
  updateItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFridgeItemDto,
  ) {
    return this.fridgeService.updateItem(user.id, id, dto);
  }

  // ── DELETE /fridge/items/:id ───────────────────────────────────────────────

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single fridge item' })
  deleteItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fridgeService.deleteItem(user.id, id);
  }

  // ── DELETE /fridge/items (bulk) ────────────────────────────────────────────

  @Delete('items')
  @ApiOperation({ summary: 'Bulk delete fridge items' })
  bulkDeleteItems(
    @CurrentUser() user: User,
    @Body() dto: BulkDeleteDto,
  ) {
    return this.fridgeService.bulkDeleteItems(user.id, dto);
  }

  // ── POST /fridge/scan ──────────────────────────────────────────────────────

  @Post('scan')
  @UseInterceptors(
    FileInterceptor('image', { storage: memoryStorage(), limits: imageUploadLimits }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
      required: ['image'],
    },
  })
  @ApiOperation({ summary: 'Start an AI fridge scan session' })
  startScan(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.fridgeService.startScan(user.id, file);
  }

  // ── GET /fridge/scan/:sessionId ────────────────────────────────────────────

  @Get('scan/:sessionId')
  @ApiOperation({ summary: 'Poll fridge scan status' })
  getScanStatus(
    @CurrentUser() user: User,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.fridgeService.getScanStatus(user.id, sessionId);
  }

  // ── POST /fridge/scan/:sessionId/confirm ───────────────────────────────────

  @Post('scan/:sessionId/confirm')
  @ApiOperation({ summary: 'Confirm and save detected items from a scan session' })
  confirmScan(
    @CurrentUser() user: User,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: ConfirmScanDto,
  ) {
    return this.fridgeService.confirmScan(user.id, sessionId, dto);
  }

  // ── POST /fridge/deduct ────────────────────────────────────────────────────

  @Post('deduct')
  @ApiOperation({ summary: 'Deduct ingredients from fridge after cooking a recipe' })
  deductIngredients(
    @CurrentUser() user: User,
    @Body() dto: DeductIngredientsDto,
  ) {
    return this.fridgeService.deductIngredients(user.id, dto);
  }
}
