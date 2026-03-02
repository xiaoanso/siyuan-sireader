/**
 * 思源原生PDF渲染器 - 100%使用思源的webViewerLoad
 * 完全保证与思源行为一致，包括TextLayerBuilder的防漂移机制
 */

interface SiyuanPDFApp {
  pdfDocument: any
  pdfViewer: any
  pdfLinkService: any
  pdfHistory: any
  pdfFindController: any
  annoId?: string
  run: (config: any) => Promise<void>
  close: () => Promise<void>
  open: (params: any) => Promise<void>
}

let webViewerLoad: ((file: string, element: HTMLElement, pdfPage?: number, annoId?: string) => SiyuanPDFApp) | null = null

/**
 * 动态加载思源的PDF viewer
 */
async function loadSiyuanPDFViewer() {
  if (webViewerLoad) return webViewerLoad
  
  try {
    // 直接导入思源的viewer.js
    const viewerModule = await import('/stage/protyle/js/pdf/viewer.mjs')
    webViewerLoad = viewerModule.webViewerLoad
    console.log('[SiYuan PDF] webViewerLoad加载成功')
    return webViewerLoad
  } catch (err) {
    console.error('[SiYuan PDF] 加载失败:', err)
    throw new Error('无法加载思源PDF viewer')
  }
}

/**
 * 思源原生PDF查看器包装类
 */
export class SiyuanPDFViewer {
  private pdfApp: SiyuanPDFApp | null = null
  private container: HTMLElement
  private currentPage = 1
  private totalPages = 0
  private onPageChange?: (page: number) => void
  private onAnnotationClick?: (annotation: any) => void

  constructor(options: {
    container: HTMLElement
    onPageChange?: (page: number) => void
    onAnnotationClick?: (annotation: any) => void
  }) {
    this.container = options.container
    this.onPageChange = options.onPageChange
    this.onAnnotationClick = options.onAnnotationClick
  }

  /**
   * 打开PDF文件 - 使用思源原生方式
   */
  async open(source: ArrayBuffer, startPage?: number) {
    const loader = await loadSiyuanPDFViewer()
    if (!loader) throw new Error('PDF viewer未加载')

    // 将ArrayBuffer转换为Blob URL（思源方式）
    const blob = new Blob([source], { type: 'application/pdf' })
    const fileUrl = URL.createObjectURL(blob)

    // 准备容器HTML（使用思源的完整HTML结构）
    this.container.innerHTML = this.getSiyuanPDFHTML()

    // 使用思源的webViewerLoad初始化
    this.pdfApp = loader(fileUrl, this.container, startPage, undefined)

    // 等待PDF加载完成
    await this.waitForPDFReady()

    // 设置页面变化监听
    this.setupPageChangeListener()

    console.log('[SiYuan PDF] PDF加载完成')
  }

  /**
   * 获取思源的PDF HTML结构（简化版，只保留核心部分）
   */
  private getSiyuanPDFHTML(): string {
    return `
      <div class="pdf__outer" id="outerContainer">
        <div id="mainContainer">
          <div id="viewerContainer">
            <div id="viewer" class="pdfViewer"></div>
          </div>
        </div>
        <div id="printContainer"></div>
      </div>
    `
  }

  /**
   * 等待PDF准备就绪
   */
  private async waitForPDFReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.pdfApp?.pdfDocument) {
          this.totalPages = this.pdfApp.pdfDocument.numPages
          this.currentPage = this.pdfApp.pdfViewer?.currentPageNumber || 1
          resolve()
        } else {
          setTimeout(checkReady, 50)
        }
      }
      checkReady()
    })
  }

  /**
   * 设置页面变化监听
   */
  private setupPageChangeListener() {
    if (!this.pdfApp?.pdfViewer) return

    // 监听思源PDF viewer的页面变化事件
    const viewer = this.pdfApp.pdfViewer
    const originalOnPageChange = viewer._currentPageNumber

    // 使用Proxy监听currentPageNumber变化
    let lastPage = this.currentPage
    const checkPageChange = () => {
      const newPage = viewer.currentPageNumber
      if (newPage !== lastPage) {
        lastPage = newPage
        this.currentPage = newPage
        this.onPageChange?.(newPage)
      }
      requestAnimationFrame(checkPageChange)
    }
    checkPageChange()
  }

  /**
   * 跳转到指定页
   */
  goToPage(page: number) {
    if (!this.pdfApp?.pdfViewer) return
    this.pdfApp.pdfViewer.currentPageNumber = page
    this.currentPage = page
  }

  /**
   * 获取当前页码
   */
  getCurrentPage(): number {
    return this.pdfApp?.pdfViewer?.currentPageNumber || this.currentPage
  }

  /**
   * 获取总页数
   */
  getPageCount(): number {
    return this.pdfApp?.pdfDocument?.numPages || this.totalPages
  }

  /**
   * 获取PDF文档对象
   */
  getPDF() {
    return this.pdfApp?.pdfDocument
  }

  /**
   * 获取PDF viewer对象
   */
  getViewer() {
    return this.pdfApp?.pdfViewer
  }

  /**
   * 缩放控制
   */
  setScale(scale: number) {
    if (!this.pdfApp?.pdfViewer) return
    this.pdfApp.pdfViewer.currentScale = scale
  }

  getScale(): number {
    return this.pdfApp?.pdfViewer?.currentScale || 1.0
  }

  /**
   * 适应宽度
   */
  async fitWidth() {
    if (!this.pdfApp?.pdfViewer) return
    this.pdfApp.pdfViewer.currentScaleValue = 'page-width'
  }

  /**
   * 适应页面
   */
  async fitPage() {
    if (!this.pdfApp?.pdfViewer) return
    this.pdfApp.pdfViewer.currentScaleValue = 'page-fit'
  }

  /**
   * 旋转
   */
  setRotation(degrees: 0 | 90 | 180 | 270) {
    if (!this.pdfApp?.pdfViewer) return
    this.pdfApp.pdfViewer.pagesRotation = degrees
  }

  getRotation(): number {
    return this.pdfApp?.pdfViewer?.pagesRotation || 0
  }

  /**
   * 获取页面元素（用于标注渲染）
   */
  getPageElement(pageNum: number): HTMLElement | null {
    return this.container.querySelector(`[data-page-number="${pageNum}"]`)
  }

  /**
   * 获取所有页面的Map（兼容旧API）
   */
  getPages(): Map<number, any> {
    const pages = new Map()
    if (!this.pdfApp?.pdfDocument) return pages
    
    for (let i = 1; i <= this.totalPages; i++) {
      // 延迟加载页面对象
      pages.set(i, {
        getViewport: (params: any) => {
          // 这里需要实际获取页面对象
          return this.pdfApp!.pdfDocument.getPage(i).then((page: any) => page.getViewport(params))
        }
      })
    }
    return pages
  }

  /**
   * 创建视图对象（兼容旧API）
   */
  async createView() {
    const n = this.getPageCount()
    const prev = () => this.goToPage(Math.max(1, this.getCurrentPage() - 1))
    const next = () => this.goToPage(Math.min(n, this.getCurrentPage() + 1))
    
    return {
      viewer: this,
      isPdf: true,
      pageCount: n,
      getThumbnail: async (p: number) => '',
      book: { toc: [], flatToc: [] },
      goTo: (t: any) => this.goToPage(typeof t === 'number' ? t : t?.pageNumber || 1),
      lastLocation: { page: 1, total: n },
      nav: { prev, next, goLeft: prev, goRight: next }
    }
  }

  /**
   * 应用主题（简化版）
   */
  applyTheme(settings: any) {
    // 思源的PDF viewer有自己的主题系统
    // 这里可以通过CSS变量来影响
    const container = this.container.querySelector('.pdf__outer') as HTMLElement
    if (!container) return

    // 应用基本主题
    if (settings.theme === 'dark') {
      container.classList.add('pdf__outer--dark')
    } else {
      container.classList.remove('pdf__outer--dark')
    }
  }

  /**
   * 更新主题
   */
  async updateTheme(settings: any) {
    this.applyTheme(settings)
  }

  /**
   * 销毁
   */
  destroy() {
    this.pdfApp?.close?.()
    this.pdfApp = null
    this.container.innerHTML = ''
  }
}
