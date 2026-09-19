#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# friyo — CloudWatch Alarms Setup
#
# Usage:
#   export AWS_PROFILE=friyo
#   export AWS_REGION=us-east-1
#   bash infra/aws/cloudwatch-alarms.sh
#
# Pre-requisites:
#   - ALB_ARN_SUFFIX  — from `aws elbv2 describe-load-balancers --query ...`
#   - TG_ARN_SUFFIX   — from `aws elbv2 describe-target-groups ...`
#   - ECS_CLUSTER     — friyo-production
#   - ECS_SERVICE     — friyo-api
#   - SNS_TOPIC_ARN   — alert destination (PagerDuty / Slack bridge)
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ALB_ARN_SUFFIX="${ALB_ARN_SUFFIX:?Set ALB_ARN_SUFFIX}"
TG_ARN_SUFFIX="${TG_ARN_SUFFIX:?Set TG_ARN_SUFFIX}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:?Set SNS_TOPIC_ARN}"
ECS_CLUSTER="${ECS_CLUSTER:-friyo-production}"
ECS_SERVICE="${ECS_SERVICE:-friyo-api}"
REGION="${AWS_REGION:-us-east-1}"

echo "Creating CloudWatch alarms in region $REGION..."

# ── Helper: create alarm ───────────────────────────────────────────────────
alarm() {
  local name="$1"; shift
  aws cloudwatch put-metric-alarm \
    --region "$REGION" \
    --alarm-name "$name" \
    --alarm-actions "$SNS_TOPIC_ARN" \
    --ok-actions    "$SNS_TOPIC_ARN" \
    --treat-missing-data notBreaching \
    "$@"
  echo "  ✓ $name"
}

# ── ALB: 5xx Error Rate > 1% ──────────────────────────────────────────────
alarm "friyo-api-5xx-error-rate" \
  --alarm-description "API 5xx error rate > 1% over 5 minutes" \
  --namespace "AWS/ApplicationELB" \
  --metric-name "HTTPCode_Target_5XX_Count" \
  --dimensions \
    Name=LoadBalancer,Value="$ALB_ARN_SUFFIX" \
    Name=TargetGroup,Value="$TG_ARN_SUFFIX" \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold

# ── ALB: P95 Latency > 2s ────────────────────────────────────────────────
alarm "friyo-api-p95-latency" \
  --alarm-description "API P95 response time > 2s over 5 minutes" \
  --namespace "AWS/ApplicationELB" \
  --metric-name "TargetResponseTime" \
  --dimensions \
    Name=LoadBalancer,Value="$ALB_ARN_SUFFIX" \
    Name=TargetGroup,Value="$TG_ARN_SUFFIX" \
  --extended-statistic p95 \
  --period 300 \
  --evaluation-periods 3 \
  --threshold 2 \
  --comparison-operator GreaterThanThreshold

# ── ECS: CPU Utilization > 80% ───────────────────────────────────────────
alarm "friyo-api-cpu-high" \
  --alarm-description "ECS CPU utilization > 80% over 10 minutes" \
  --namespace "AWS/ECS" \
  --metric-name "CPUUtilization" \
  --dimensions \
    Name=ClusterName,Value="$ECS_CLUSTER" \
    Name=ServiceName,Value="$ECS_SERVICE" \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold

# ── ECS: Memory Utilization > 85% ───────────────────────────────────────
alarm "friyo-api-memory-high" \
  --alarm-description "ECS memory utilization > 85% over 10 minutes" \
  --namespace "AWS/ECS" \
  --metric-name "MemoryUtilization" \
  --dimensions \
    Name=ClusterName,Value="$ECS_CLUSTER" \
    Name=ServiceName,Value="$ECS_SERVICE" \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 85 \
  --comparison-operator GreaterThanThreshold

# ── ECS: Unhealthy task count > 0 ───────────────────────────────────────
alarm "friyo-api-unhealthy-tasks" \
  --alarm-description "One or more ECS tasks are unhealthy" \
  --namespace "AWS/ApplicationELB" \
  --metric-name "UnHealthyHostCount" \
  --dimensions \
    Name=LoadBalancer,Value="$ALB_ARN_SUFFIX" \
    Name=TargetGroup,Value="$TG_ARN_SUFFIX" \
  --statistic Maximum \
  --period 60 \
  --evaluation-periods 2 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold

# ── RDS: CPU > 80% ──────────────────────────────────────────────────────
alarm "friyo-rds-cpu-high" \
  --alarm-description "RDS CPU > 80% for 15 minutes" \
  --namespace "AWS/RDS" \
  --metric-name "CPUUtilization" \
  --dimensions Name=DBInstanceIdentifier,Value=friyo-postgres-prod \
  --statistic Average \
  --period 300 \
  --evaluation-periods 3 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold

# ── RDS: Free storage < 10 GB ───────────────────────────────────────────
alarm "friyo-rds-low-storage" \
  --alarm-description "RDS free storage < 10 GB" \
  --namespace "AWS/RDS" \
  --metric-name "FreeStorageSpace" \
  --dimensions Name=DBInstanceIdentifier,Value=friyo-postgres-prod \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 10737418240 \
  --comparison-operator LessThanThreshold

# ── Redis: CPU Engine Utilization > 75% ─────────────────────────────────
alarm "friyo-redis-cpu-high" \
  --alarm-description "ElastiCache Redis engine CPU > 75%" \
  --namespace "AWS/ElastiCache" \
  --metric-name "EngineCPUUtilization" \
  --dimensions Name=ReplicationGroupId,Value=friyo-redis-prod \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 75 \
  --comparison-operator GreaterThanThreshold

echo ""
echo "✅  All CloudWatch alarms created. SNS topic: $SNS_TOPIC_ARN"
