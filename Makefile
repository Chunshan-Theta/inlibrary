# 研究室論文管理系統 Makefile
# 提供便捷的項目管理命令

.PHONY: help build up down restart logs clean dev install backup restore

# 默認目標
help: ## 顯示幫助信息
	@echo "研究室論文管理系統 - 可用命令:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'


up: ## 啟動所有服務
	@echo "🚀 啟動所有服務..."
	docker-compose up -d --build

down: ## 停止所有服務
	@echo "🛑 停止所有服務..."
	docker-compose down

clean: ## 清除所有服務鏡像
	@echo "🧹 清除所有服務鏡像..."
	docker-compose down -v
