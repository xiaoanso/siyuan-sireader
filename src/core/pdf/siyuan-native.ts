/**
 * 思源原生 PDF 渲染器 - 100% 使用思源的方式
 */

// 直接使用思源的 webViewerLoad
export async function loadSiyuanPDF(container: HTMLElement, url: string, page?: number) {
  // 动态导入思源的 PDF viewer
  const { webViewerLoad } = await import('/stage/protyle/js/pdf/viewer.mjs')
  
  // 直接调用思源的方法
  const pdfObject = webViewerLoad(url, container, page)
  
  return pdfObject
}
