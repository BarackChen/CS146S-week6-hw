# 第七週

本週的專案和之前一樣，是一個簡單的筆記 + 待辦事項網頁。

## 安裝

第一次啟動之前，請使用 `uv sync` 安裝依賴。

## 啟動專案

執行 `uv run make` 啟動伺服器，預設會啟動在：`http://127.0.0.1:8000`

## 其它指令

- `uv run make test`：測試
- `uv run make format`：整理程式碼格式並自動修正部分 lint 問題
- `uv run make lint`：檢查程式碼風格
- `uv run make seed`：初始化資料庫 seed