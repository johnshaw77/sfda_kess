-- KESS 知識提取與摘要系統資料庫初始化腳本
-- 使用與 sfda_nexus 相同的資料庫，但使用 kess_ 前綴區分表格

-- 不需要建立資料庫，使用現有的 sfda_nexus 資料庫
-- CREATE DATABASE IF NOT EXISTS kess_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE kess_db;

-- 功能類別管理表
CREATE TABLE IF NOT EXISTS kess_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_code VARCHAR(20) NOT NULL COMMENT '功能代碼（如：MFG, QA, IT）',
    category_name VARCHAR(50) NOT NULL COMMENT '功能名稱（如：製造、品保、資訊）',
    description TEXT COMMENT '功能描述',
    watch_folder VARCHAR(500) COMMENT '監控資料夾路徑',
    archive_folder VARCHAR(500) COMMENT '歸檔資料夾路徑',
    file_pattern VARCHAR(200) COMMENT '檔案命名模式（正規表達式）',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    sort_order INT DEFAULT 0 COMMENT '排序順序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    UNIQUE KEY uk_category_code (category_code),
    INDEX idx_is_active (is_active),
    INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='功能類別管理表';

-- 文件記錄表
CREATE TABLE IF NOT EXISTS kess_documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL COMMENT '功能類別 ID',
    file_path VARCHAR(500) NOT NULL COMMENT '檔案路徑',
    original_path VARCHAR(500) NOT NULL COMMENT '原始檔案路徑',
    archive_path VARCHAR(500) COMMENT '歸檔路徑',
    file_name VARCHAR(255) NOT NULL COMMENT '檔案名稱',
    file_extension VARCHAR(10) NOT NULL COMMENT '檔案副檔名',
    file_size BIGINT NOT NULL COMMENT '檔案大小（位元組）',
    file_hash VARCHAR(64) NOT NULL COMMENT '檔案雜湊值（SHA-256）',
    file_modified_time DATETIME NOT NULL COMMENT '檔案修改時間',
    content_preview TEXT COMMENT '內容預覽（前500字）',
    word_count INT DEFAULT 0 COMMENT '字數統計',
    processing_status ENUM('pending', 'processing', 'completed', 'failed', 'archived') DEFAULT 'pending' COMMENT '處理狀態',
    is_archived BOOLEAN DEFAULT FALSE COMMENT '是否已歸檔',
    archived_at DATETIME NULL COMMENT '歸檔時間',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    INDEX idx_category_id (category_id),
    INDEX idx_file_path (file_path),
    INDEX idx_file_hash (file_hash),
    INDEX idx_processing_status (processing_status),
    INDEX idx_is_archived (is_archived),
    INDEX idx_created_at (created_at),
    UNIQUE KEY uk_file_path_hash (file_path, file_hash),
    FOREIGN KEY (category_id) REFERENCES kess_categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件記錄表';

-- 摘要結果表
CREATE TABLE IF NOT EXISTS kess_summaries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    document_id INT NOT NULL COMMENT '文件 ID',
    summary_text TEXT NOT NULL COMMENT '摘要內容',
    key_points JSON COMMENT '關鍵要點（JSON 格式）',
    keywords JSON COMMENT '關鍵字（JSON 格式）',
    entities JSON COMMENT '實體識別結果（JSON 格式）',
    llm_provider VARCHAR(50) NOT NULL COMMENT 'LLM 提供者',
    llm_model VARCHAR(100) NOT NULL COMMENT 'LLM 模型名稱',
    processing_time_ms INT COMMENT '處理時間（毫秒）',
    token_usage JSON COMMENT 'Token 使用量（JSON 格式）',
    confidence_score DECIMAL(3,2) COMMENT '可信度分數（0-1）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    INDEX idx_document_id (document_id),
    INDEX idx_created_at (created_at),
    INDEX idx_llm_provider (llm_provider),
    FOREIGN KEY (document_id) REFERENCES kess_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='摘要結果表';

-- 處理日誌表
CREATE TABLE IF NOT EXISTS kess_processing_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    document_id INT COMMENT '文件 ID（可為空，用於系統級日誌）',
    log_level ENUM('debug', 'info', 'warn', 'error') NOT NULL COMMENT '日誌等級',
    log_message TEXT NOT NULL COMMENT '日誌訊息',
    log_details JSON COMMENT '詳細資訊（JSON 格式）',
    error_stack TEXT COMMENT '錯誤堆疊（如果有錯誤）',
    processing_stage VARCHAR(50) COMMENT '處理階段',
    execution_time_ms INT COMMENT '執行時間（毫秒）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    INDEX idx_document_id (document_id),
    INDEX idx_log_level (log_level),
    INDEX idx_created_at (created_at),
    INDEX idx_processing_stage (processing_stage),
    FOREIGN KEY (document_id) REFERENCES kess_documents(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='處理日誌表';

-- 監控資料夾設定表
CREATE TABLE IF NOT EXISTS kess_watched_folders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    folder_path VARCHAR(500) NOT NULL COMMENT '監控資料夾路徑',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用監控',
    watch_recursive BOOLEAN DEFAULT TRUE COMMENT '是否遞迴監控子資料夾',
    file_pattern VARCHAR(200) COMMENT '檔案匹配模式（正規表達式）',
    exclude_pattern VARCHAR(200) COMMENT '排除模式（正規表達式）',
    last_scan_time TIMESTAMP NULL COMMENT '最後掃描時間',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    INDEX idx_is_active (is_active),
    INDEX idx_last_scan_time (last_scan_time),
    UNIQUE KEY uk_folder_path (folder_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='監控資料夾設定表';

-- 系統設定表
CREATE TABLE IF NOT EXISTS kess_system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL COMMENT '設定鍵值',
    setting_value TEXT COMMENT '設定值',
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' COMMENT '設定類型',
    description TEXT COMMENT '設定描述',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '建立時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    UNIQUE KEY uk_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系統設定表';

-- 插入預設功能類別
INSERT INTO kess_categories (category_code, category_name, description, watch_folder, archive_folder, sort_order) VALUES
('MFG', '製造部門', '製造相關文件，包含生產計劃、工藝文件、設備維護等', './watch/manufacturing', './archive/manufacturing', 1),
('QA', '品保部門', '品質保證相關文件，包含檢驗報告、品質標準、不良分析等', './watch/quality', './archive/quality', 2),
('IT', '資訊部門', '資訊技術相關文件，包含系統文檔、技術規範、維護記錄等', './watch/it', './archive/it', 3),
('HR', '人資部門', '人力資源相關文件，包含招聘、培訓、績效評估等', './watch/hr', './archive/hr', 4),
('FIN', '財務部門', '財務相關文件，包含報表、預算、採購、會計等', './watch/finance', './archive/finance', 5),
('R&D', '研發部門', '研發相關文件，包含產品設計、技術研究、專利等', './watch/rnd', './archive/rnd', 6),
('ADMIN', '行政部門', '行政管理相關文件，包含公告、政策、會議記錄等', './watch/admin', './archive/admin', 7)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 插入預設設定
INSERT INTO kess_system_settings (setting_key, setting_value, setting_type, description) VALUES
('system_version', '1.0.0', 'string', '系統版本'),
('auto_process_enabled', 'true', 'boolean', '是否啟用自動處理'),
('max_concurrent_jobs', '5', 'number', '最大並發處理任務數'),
('default_summary_language', 'zh-TW', 'string', '預設摘要語言')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 建立檢視：文件摘要概覽（包含功能分類）
CREATE OR REPLACE VIEW kess_document_summary_overview AS
SELECT 
    d.id,
    c.category_code,
    c.category_name,
    d.file_name,
    d.file_path,
    d.archive_path,
    d.file_size,
    d.word_count,
    d.processing_status,
    d.is_archived,
    d.created_at as document_created_at,
    s.summary_text,
    s.llm_provider,
    s.llm_model,
    s.processing_time_ms,
    s.confidence_score,
    s.created_at as summary_created_at
FROM kess_documents d
LEFT JOIN kess_categories c ON d.category_id = c.id
LEFT JOIN kess_summaries s ON d.id = s.document_id
ORDER BY d.created_at DESC;

-- 建立檢視：功能別處理統計
CREATE OR REPLACE VIEW kess_category_statistics AS
SELECT 
    c.category_code,
    c.category_name,
    COUNT(d.id) as total_documents,
    COUNT(CASE WHEN d.processing_status = 'completed' THEN 1 END) as completed_documents,
    COUNT(CASE WHEN d.processing_status = 'pending' THEN 1 END) as pending_documents,
    COUNT(CASE WHEN d.processing_status = 'failed' THEN 1 END) as failed_documents,
    COUNT(CASE WHEN d.is_archived = TRUE THEN 1 END) as archived_documents,
    SUM(d.file_size) as total_file_size,
    AVG(d.word_count) as avg_word_count,
    COUNT(s.id) as total_summaries,
    AVG(s.confidence_score) as avg_confidence_score
FROM kess_categories c
LEFT JOIN kess_documents d ON c.id = d.category_id
LEFT JOIN kess_summaries s ON d.id = s.document_id
WHERE c.is_active = TRUE
GROUP BY c.id, c.category_code, c.category_name
ORDER BY c.sort_order;

-- 建立檢視：各功能部門的文件檢視
CREATE OR REPLACE VIEW kess_manufacturing_documents AS
SELECT d.*, c.category_name FROM kess_documents d 
JOIN kess_categories c ON d.category_id = c.id 
WHERE c.category_code = 'MFG' AND c.is_active = TRUE;

CREATE OR REPLACE VIEW kess_quality_documents AS
SELECT d.*, c.category_name FROM kess_documents d 
JOIN kess_categories c ON d.category_id = c.id 
WHERE c.category_code = 'QA' AND c.is_active = TRUE;

CREATE OR REPLACE VIEW kess_it_documents AS
SELECT d.*, c.category_name FROM kess_documents d 
JOIN kess_categories c ON d.category_id = c.id 
WHERE c.category_code = 'IT' AND c.is_active = TRUE;

-- 建立檢視：處理統計
CREATE OR REPLACE VIEW kess_processing_statistics AS
SELECT 
    DATE(d.created_at) as processing_date,
    c.category_name,
    d.processing_status,
    COUNT(*) as document_count,
    AVG(d.file_size) as avg_file_size,
    SUM(d.file_size) as total_file_size
FROM kess_documents d
JOIN kess_categories c ON d.category_id = c.id
GROUP BY DATE(d.created_at), c.category_name, d.processing_status
ORDER BY processing_date DESC, c.sort_order;

COMMIT;
