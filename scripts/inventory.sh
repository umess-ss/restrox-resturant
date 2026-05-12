#!/bin/bash

set -e

REGION="us-east-1"

echo "=============================="
echo "ECR Repositories"
echo "=============================="
aws ecr describe-repositories \
  --region "$REGION" \
  --query "repositories[*].repositoryName" \
  --output table || true

echo "=============================="
echo "ECS Clusters"
echo "=============================="
aws ecs list-clusters \
  --region "$REGION" \
  --output table || true

echo "=============================="
echo "ECS Services"
echo "=============================="
for CLUSTER in $(aws ecs list-clusters --region "$REGION" --query "clusterArns[]" --output text); do
  echo "Cluster: $CLUSTER"
  aws ecs list-services \
    --cluster "$CLUSTER" \
    --region "$REGION" \
    --output table || true
done

echo "=============================="
echo "Load Balancers"
echo "=============================="
aws elbv2 describe-load-balancers \
  --region "$REGION" \
  --query "LoadBalancers[*].[LoadBalancerName,DNSName,Scheme,Type,VpcId]" \
  --output table || true

echo "=============================="
echo "Target Groups"
echo "=============================="
aws elbv2 describe-target-groups \
  --region "$REGION" \
  --query "TargetGroups[*].[TargetGroupName,TargetGroupArn,Port,Protocol,VpcId]" \
  --output table || true

echo "=============================="
echo "Elastic IPs"
echo "=============================="
aws ec2 describe-addresses \
  --region "$REGION" \
  --query "Addresses[*].[AllocationId,PublicIp,InstanceId,AssociationId]" \
  --output table || true

echo "=============================="
echo "Security Groups"
echo "=============================="
aws ec2 describe-security-groups \
  --region "$REGION" \
  --query "SecurityGroups[*].[GroupName,GroupId,VpcId,Description]" \
  --output table || true

echo "=============================="
echo "SSM Parameters"
echo "=============================="
aws ssm describe-parameters \
  --region "$REGION" \
  --query "Parameters[*].[Name,Type]" \
  --output table || true