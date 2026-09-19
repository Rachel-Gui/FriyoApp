# Friyo — AWS Infrastructure Setup

This document describes the AWS infrastructure for Friyo and the steps to provision each component.

---

## Architecture Overview

```
Internet
  │
  ├─► Route 53
  │     ├─ api.friyo.app    → ALB → ECS Fargate (NestJS API)
  │     └─ admin.friyo.app  → CloudFront → Next.js (Vercel / S3)
  │
  ├─► WAF  ──────────────── attached to ALB
  │
  ├─► CloudFront ─────────── friyo-media CDN (S3 private origin)
  │
  └─► AWS Services
        ├─ RDS PostgreSQL 15 (Multi-AZ)
        ├─ ElastiCache Redis 7
        ├─ S3  — friyo-media (private)
        ├─ SES — transactional email
        ├─ Rekognition — image moderation
        └─ CloudWatch — logging & alarms
```

---

## Prerequisites

```bash
# Install/update AWS CLI
brew install awscli   # or: pip install awscli

# Configure credentials (use IAM role in prod, keys only in dev)
aws configure --profile friyo
# AWS Access Key ID: ...
# AWS Secret Access Key: ...
# Default region: us-east-1
# Default output format: json

export AWS_PROFILE=friyo
export AWS_REGION=us-east-1
```

---

## 1. ACM Certificate (SSL/TLS)

```bash
# Request wildcard certificate (must be in us-east-1 for CloudFront)
aws acm request-certificate \
  --domain-name "*.friyo.app" \
  --validation-method DNS \
  --subject-alternative-names "friyo.app" \
  --region us-east-1

# Note the CertificateArn — needed for CloudFront and ALB
```

Complete DNS validation in Route 53, then wait for status = ISSUED.

---

## 2. VPC & Networking

```bash
# Create VPC (10.0.0.0/16)
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=friyo-vpc}]' \
  --query Vpc.VpcId --output text)

# Create public subnets (for ALB)
aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=friyo-public-1a}]'

aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=friyo-public-1b}]'

# Create private subnets (for ECS, RDS, ElastiCache)
aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.10.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=friyo-private-1a}]'

aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.11.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=friyo-private-1b}]'

# Internet Gateway + NAT Gateway for private subnet egress
# (omitted for brevity — follow standard AWS VPC setup guide)
```

---

## 3. RDS PostgreSQL 15

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name friyo-db-subnet \
  --db-subnet-group-description "Friyo RDS subnet group" \
  --subnet-ids subnet-private-1a subnet-private-1b

# Create parameter group (UTF-8, performance settings)
aws rds create-db-parameter-group \
  --db-parameter-group-name friyo-postgres15 \
  --db-parameter-group-family postgres15 \
  --description "Friyo PostgreSQL 15 params"

# Set connection pooling params
aws rds modify-db-parameter-group \
  --db-parameter-group-name friyo-postgres15 \
  --parameters \
    "ParameterName=max_connections,ParameterValue=200,ApplyMethod=pending-reboot" \
    "ParameterName=shared_buffers,ParameterValue=256MB,ApplyMethod=pending-reboot"

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier friyo-postgres-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username friyo_admin \
  --master-user-password "$(openssl rand -base64 32)" \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --db-subnet-group-name friyo-db-subnet \
  --backup-retention-period 7 \
  --preferred-backup-window "02:00-03:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --deletion-protection \
  --db-name friyo \
  --db-parameter-group-name friyo-postgres15 \
  --tags Key=Project,Value=friyo Key=Env,Value=production
```

**Staging:** Use `db.t3.micro` with `--no-multi-az`.

---

## 4. ElastiCache Redis 7

```bash
# Create subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name friyo-redis-subnet \
  --cache-subnet-group-description "Friyo ElastiCache subnet" \
  --subnet-ids subnet-private-1a subnet-private-1b

# Development: single node
aws elasticache create-cache-cluster \
  --cache-cluster-id friyo-redis-dev \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name friyo-redis-subnet

# Production: replication group (cluster mode disabled, 1 replica)
aws elasticache create-replication-group \
  --replication-group-id friyo-redis-prod \
  --replication-group-description "Friyo Redis production" \
  --num-cache-clusters 2 \
  --cache-node-type cache.t3.small \
  --engine redis \
  --engine-version 7.0 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --cache-subnet-group-name friyo-redis-subnet \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled
```

---

## 5. S3 — Media Storage

```bash
# Create private bucket
aws s3api create-bucket \
  --bucket friyo-media \
  --region us-east-1

# Block all public access
aws s3api put-public-access-block \
  --bucket friyo-media \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket friyo-media \
  --versioning-configuration Status=Enabled

# Server-side encryption
aws s3api put-bucket-encryption \
  --bucket friyo-media \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "AES256" }
    }]
  }'

# Lifecycle: delete incomplete multipart uploads after 7 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket friyo-media \
  --lifecycle-configuration file://infra/aws/s3-lifecycle.json
```

---

## 6. CloudFront — Media CDN

```bash
# Create Origin Access Control for S3
OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "friyo-media-oac",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' \
  --query OriginAccessControl.Id --output text)

# Create CloudFront distribution (see ecs-task-definition.json for full config)
# Distribution domain → media.friyo.app via Route 53 CNAME
# Cache behaviors: images 1 year, presigned URLs no-cache
```

---

## 7. ECS Fargate

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name friyo-backend \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Create ECS cluster
aws ecs create-cluster \
  --cluster-name friyo-production \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1,base=1 \
    capacityProvider=FARGATE_SPOT,weight=4

# Register task definition (see ecs-task-definition.json)
aws ecs register-task-definition \
  --cli-input-json file://infra/aws/ecs-task-definition.json

# Create service with auto-scaling
aws ecs create-service \
  --cluster friyo-production \
  --service-name friyo-api \
  --task-definition friyo-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[subnet-private-1a,subnet-private-1b],
    securityGroups=[sg-api],
    assignPublicIp=DISABLED
  }" \
  --load-balancers \
    "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=friyo-api,containerPort=3000" \
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200" \
  --health-check-grace-period-seconds 60

# Auto Scaling: 2–10 instances based on CPU
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/friyo-production/friyo-api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/friyo-production/friyo-api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name friyo-api-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

---

## 8. Application Load Balancer

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name friyo-alb \
  --subnets subnet-public-1a subnet-public-1b \
  --security-groups sg-alb \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --query LoadBalancers[0].LoadBalancerArn --output text)

# Target group
TG_ARN=$(aws elbv2 create-target-group \
  --name friyo-api-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/v1/health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query TargetGroups[0].TargetGroupArn --output text)

# HTTPS listener (port 443)
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
  --certificates CertificateArn=arn:aws:acm:us-east-1:...:certificate/... \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# HTTP → HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions \
    Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"
```

---

## 9. WAF

```bash
# Create WAF WebACL with AWS managed rule sets
aws wafv2 create-web-acl \
  --name friyo-waf \
  --scope REGIONAL \
  --region us-east-1 \
  --default-action Allow={} \
  --rules file://infra/aws/waf-rules.json \
  --visibility-config \
    SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=FriyoWAF

# Attach to ALB
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:us-east-1:...:regional/webacl/friyo-waf/... \
  --resource-arn $ALB_ARN
```

Managed rule groups to enable:
- `AWSManagedRulesCommonRuleSet` — OWASP Top 10
- `AWSManagedRulesKnownBadInputsRuleSet` — Log4Shell, SSRF, etc.
- `AWSManagedRulesAmazonIpReputationList` — Known malicious IPs
- `AWSManagedRulesSQLiRuleSet` — SQL injection patterns

---

## 10. CloudWatch — Logs & Alarms

```bash
# Create log group
aws logs create-log-group \
  --log-group-name /friyo/api/production \
  --retention-in-days 30

# See cloudwatch-alarms.sh for alarm setup
bash infra/aws/cloudwatch-alarms.sh
```

---

## 11. Route 53

```bash
# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name friyo.app \
  --query HostedZones[0].Id --output text | cut -d/ -f3)

# api.friyo.app → ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.friyo.app",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "friyo-alb-xxx.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

---

## Environments

| Resource      | Development           | Staging              | Production            |
|---------------|-----------------------|----------------------|-----------------------|
| RDS           | docker-compose local  | db.t3.micro, no MAZ  | db.t3.medium, MAZ     |
| Redis         | docker-compose local  | cache.t3.micro       | cache.t3.small + replica |
| ECS           | —                     | 1 task, no autoscale | 2–10 tasks, autoscale |
| CloudFront    | —                     | same as prod         | friyo-media + admin   |
| WAF           | —                     | attached to ALB      | attached to ALB       |

---

## Secrets Management

All sensitive values are stored in **AWS Secrets Manager** and injected into ECS tasks at runtime:

```bash
# Store each secret
aws secretsmanager create-secret \
  --name friyo/production/DATABASE_URL \
  --secret-string "postgresql://..."

aws secretsmanager create-secret \
  --name friyo/production/JWT_SECRET \
  --secret-string "$(openssl rand -base64 48)"

# In ecs-task-definition.json, reference via:
# { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..." }
```
