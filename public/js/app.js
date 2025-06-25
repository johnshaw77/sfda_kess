// KESS 知識提取與摘要系統 - 前端 JavaScript

document.addEventListener("DOMContentLoaded", function () {
  // 初始化工具提示
  initializeTooltips();

  // 初始化通知系統
  initializeNotifications();

  console.log("KESS Web 系統已載入");
});

// 初始化 Bootstrap 工具提示
function initializeTooltips() {
  var tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// 初始化通知系統
function initializeNotifications() {
  // 創建通知容器
  if (!document.getElementById("notificationContainer")) {
    const container = document.createElement("div");
    container.id = "notificationContainer";
    container.className = "position-fixed top-0 end-0 p-3";
    container.style.zIndex = "1055";
    document.body.appendChild(container);
  }
}

// 顯示通知
function showNotification(message, type = "info", duration = 3000) {
  const container = document.getElementById("notificationContainer");
  if (!container) return;

  const alertId = "alert-" + Date.now();
  const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            <i class="bi bi-${getNotificationIcon(type)}"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;

  container.insertAdjacentHTML("beforeend", alertHtml);

  // 自動消失
  if (duration > 0) {
    setTimeout(() => {
      const alert = document.getElementById(alertId);
      if (alert) {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }
    }, duration);
  }
}

// 獲取通知圖示
function getNotificationIcon(type) {
  const icons = {
    success: "check-circle",
    danger: "exclamation-triangle",
    warning: "exclamation-triangle",
    info: "info-circle",
    primary: "info-circle",
  };
  return icons[type] || "info-circle";
}

// 複製文字到剪貼簿
async function copyToClipboard(text, successMessage = "已複製到剪貼簿") {
  try {
    await navigator.clipboard.writeText(text);
    showNotification(successMessage, "success");
  } catch (err) {
    console.error("複製失敗:", err);
    showNotification("複製失敗", "danger");
  }
}

// 格式化檔案大小
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 導出全域函數
window.KESS = {
  showNotification,
  copyToClipboard,
  formatFileSize,
};
