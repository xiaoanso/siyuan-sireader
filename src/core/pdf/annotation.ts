/**
 * PDF标注核心 - 完全复制思源笔记anno.ts的实现
 */

export interface PdfRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface PdfAnnotation {
  id: string
  index: number  // 页码索引
  coords: number[][]  // PDF坐标数组 [x1, y1, x2, y2]
  color: string
  content: string
  type: 'text' | 'border'
  mode: 'text' | 'rect'
}

export interface PdfPageInfo {
  index: number
  positions: number[][]
}

/**
 * hasClosestByClassName - 思源原始实现
 */
export const hasClosestByClassName = (element: Node | null, className: string): HTMLElement | null => {
  let cur = element?.nodeType === 1 ? element as HTMLElement : (element as any)?.parentElement
  while (cur) {
    if (cur.classList?.contains(className)) return cur
    cur = cur.parentElement
  }
  return null
}

/**
 * getTextNode - 思源原始实现
 * 查找页面中的文本节点（首个或末尾）
 */
export function getTextNode(element: HTMLElement, isFirst: boolean): Element | null {
  const spans = element.querySelectorAll('span[role="presentation"]') || element.querySelectorAll('span')
  let i = isFirst ? 0 : spans.length - 1
  const step = isFirst ? 1 : -1
  while (spans[i] && !(spans[i].textContent?.trim())) i += step
  return spans[i] || null
}

/**
 * mergeRects - 思源原始实现
 * 合并同一行的矩形（关键算法，防止漂移）
 */
export function mergeRects(range: Range): PdfRect[] {
  console.log('[PDF Debug] ========== mergeRects 开始 ==========')
  const rects = range.getClientRects()
  console.log('[PDF Debug] 原始矩形数量:', rects.length)
  
  const merged: PdfRect[] = []
  let lastTop: number | undefined
  
  Array.from(rects).forEach((r, i) => {
    console.log(`[PDF Debug] 原始矩形${i + 1}:`, {
      left: r.left.toFixed(2),
      top: r.top.toFixed(2),
      right: r.right.toFixed(2),
      bottom: r.bottom.toFixed(2),
      width: r.width.toFixed(2),
      height: r.height.toFixed(2)
    })
    
    if (r.height === 0 || r.width === 0) {
      console.log(`[PDF Debug] ⚠️ 跳过空矩形${i + 1}`)
      return
    }
    
    // 关键逻辑：同一行（top差距<4px）则扩展右边界，否则新建矩形
    const topDiff = typeof lastTop === 'undefined' ? Infinity : Math.abs(lastTop - r.top)
    console.log(`[PDF Debug] 矩形${i + 1} top差距: ${topDiff.toFixed(2)}px (阈值: 4px)`)
    
    if (topDiff > 4) {
      merged.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
      lastTop = r.top
      console.log(`[PDF Debug] ✓ 新行，创建矩形${merged.length}`)
    } else {
      const oldRight = merged[merged.length - 1].right
      merged[merged.length - 1].right = r.right
      console.log(`[PDF Debug] ✓ 同行，扩展矩形${merged.length}右边界: ${oldRight.toFixed(2)} → ${r.right.toFixed(2)}`)
    }
  })
  
  console.log('[PDF Debug] 合并后矩形数量:', merged.length)
  merged.forEach((m, i) => {
    console.log(`[PDF Debug] 合并矩形${i + 1}:`, {
      left: m.left.toFixed(2),
      top: m.top.toFixed(2),
      right: m.right.toFixed(2),
      bottom: m.bottom.toFixed(2),
      width: (m.right - m.left).toFixed(2),
      height: (m.bottom - m.top).toFixed(2)
    })
  })
  console.log('[PDF Debug] ========== mergeRects 结束 ==========')
  return merged
}

/**
 * getHighlightCoordsByRange - 思源原始实现
 * 从Range获取高亮坐标 - 支持跨页选择
 */
export function getHighlightCoordsByRange(
  viewer: any,
  range: Range,
  color: string
): PdfAnnotation[] | null {
  console.log('[PDF Debug] ========== getHighlightCoordsByRange 开始 ==========')
  console.log('[PDF Debug] Range详情:', {
    startContainer: range.startContainer.nodeName,
    startOffset: range.startOffset,
    endContainer: range.endContainer.nodeName,
    endOffset: range.endOffset,
    collapsed: range.collapsed,
    text: range.toString().substring(0, 100)
  })
  
  // 检查Range的边界元素
  const startElement = range.startContainer.nodeType === 1 
    ? range.startContainer as HTMLElement 
    : range.startContainer.parentElement
  const endElement = range.endContainer.nodeType === 1 
    ? range.endContainer as HTMLElement 
    : range.endContainer.parentElement
  
  console.log('[PDF Debug] 起始元素:', {
    tagName: startElement?.tagName,
    className: startElement?.className,
    textContent: startElement?.textContent?.substring(0, 30)
  })
  console.log('[PDF Debug] 结束元素:', {
    tagName: endElement?.tagName,
    className: endElement?.className,
    textContent: endElement?.textContent?.substring(0, 30)
  })
  
  if (!viewer?.getPages) {
    console.log('[PDF Debug] ❌ viewer无效')
    return null
  }

  // 获取起始页和结束页
  const startPageElement = hasClosestByClassName(range.startContainer, 'pdf-page')
  const endPageElement = hasClosestByClassName(range.endContainer, 'pdf-page')
  
  if (!startPageElement || !endPageElement) {
    console.log('[PDF Debug] ❌ 找不到页面元素')
    console.log('[PDF Debug] startContainer路径:', getElementPath(range.startContainer))
    console.log('[PDF Debug] endContainer路径:', getElementPath(range.endContainer))
    return null
  }

  const startIndex = parseInt(startPageElement.getAttribute('data-page') || '1') - 1
  const endIndex = parseInt(endPageElement.getAttribute('data-page') || '1') - 1
  
  console.log('[PDF Debug] 起始页:', startIndex + 1, '结束页:', endIndex + 1)
  console.log('[PDF Debug] 起始页元素:', startPageElement.className)
  console.log('[PDF Debug] 结束页元素:', endPageElement.className)
  
  // 检查是否选择了非文本层的内容
  const startInTextLayer = hasClosestByClassName(range.startContainer, 'textLayer')
  const endInTextLayer = hasClosestByClassName(range.endContainer, 'textLayer')
  console.log('[PDF Debug] 起始在文本层:', !!startInTextLayer)
  console.log('[PDF Debug] 结束在文本层:', !!endInTextLayer)
  
  if (!startInTextLayer || !endInTextLayer) {
    console.log('[PDF Debug] ⚠️ 警告：选择范围超出文本层！')
  }
  
  // 检测异常选择：如果getClientRects()返回的矩形数量异常多（>6个），可能是拖到空白区域导致的
  const clientRects = range.getClientRects()
  if (clientRects.length > 6) {
    console.log('[PDF Debug] ⚠️ 检测到异常多的矩形:', clientRects.length)
    console.log('[PDF Debug] 这可能是拖到空白区域导致的过度选择')
    
    // 尝试修正：只保留前2行的选择
    try {
      const newRange = document.createRange()
      newRange.setStart(range.startContainer, range.startOffset)
      
      // 找到第2个换行位置
      const text = range.toString()
      const lines = text.split('\n').filter(l => l.trim())
      
      if (lines.length > 2) {
        console.log('[PDF Debug] 尝试截断到前2行...')
        const targetLength = lines[0].length + lines[1].length + 2 // +2 for newlines
        
        // 遍历文本节点，找到目标位置
        const walker = document.createTreeWalker(
          range.commonAncestorContainer,
          NodeFilter.SHOW_TEXT,
          null
        )
        
        let currentLength = 0
        let targetNode: Node | null = null
        let targetOffset = 0
        
        let node: Node | null
        while (node = walker.nextNode()) {
          if (!range.intersectsNode(node)) continue
          
          const nodeText = node.textContent || ''
          if (currentLength + nodeText.length >= targetLength) {
            targetNode = node
            targetOffset = targetLength - currentLength
            break
          }
          currentLength += nodeText.length
        }
        
        if (targetNode) {
          newRange.setEnd(targetNode, targetOffset)
          console.log('[PDF Debug] ✓ 成功截断选择范围')
          console.log('[PDF Debug] 原始文本长度:', text.length, '截断后:', newRange.toString().length)
          
          // 替换当前选择
          const sel = window.getSelection()
          if (sel) {
            sel.removeAllRanges()
            sel.addRange(newRange)
            
            // 使用修正后的range继续处理
            return getHighlightCoordsByRange(viewer, newRange, color)
          }
        }
      }
    } catch (err) {
      console.log('[PDF Debug] 修正失败:', err)
    }
  }

  // 处理换行符和连字符（思源优化）
  const rc = range.cloneContents()
  Array.from(rc.children).forEach(item => {
    if (item.tagName === 'BR' && item.previousElementSibling && item.nextElementSibling) {
      const prev = item.previousElementSibling.textContent || ''
      const next = item.nextElementSibling.textContent || ''
      if (/^[A-Za-z]$/.test(prev.slice(-2, -1)) && /^[A-Za-z]$/.test(next[0])) {
        if (prev.endsWith('-')) {
          item.previousElementSibling.textContent = prev.slice(0, -1)
        } else {
          item.insertAdjacentText('afterend', ' ')
        }
      }
    }
  })

  const content = rc.textContent?.replace(/[\x00]|\n/g, '') || ''
  console.log('[PDF Debug] 选中文本:', content.substring(0, 100))

  // 获取页面信息
  const pages = viewer.getPages()
  const startPage = pages?.get(startIndex + 1)
  const startCanvas = startPageElement.querySelector('canvas')
  
  if (!pages || !startPage || !startCanvas) {
    console.log('[PDF Debug] ❌ 无法获取页面对象或canvas')
    return null
  }

  const startPageRect = startCanvas.getBoundingClientRect()
  const startViewport = startPage.getViewport({ scale: viewer.getScale(), rotation: 0 })
  
  console.log('[PDF Debug] 起始页canvas位置:', {
    x: startPageRect.x.toFixed(2),
    y: startPageRect.y.toFixed(2),
    width: startPageRect.width.toFixed(2),
    height: startPageRect.height.toFixed(2)
  })

  const cloneRange = range.cloneRange()

  // 跨页处理：截断起始页到页尾
  if (startIndex !== endIndex) {
    const textLayer = startPageElement.querySelector('.textLayer') as HTMLElement
    const lastNode = textLayer && getTextNode(textLayer, false)
    if (lastNode) {
      range.setEndAfter(lastNode)
      console.log('[PDF Debug] 跨页选择，调整起始页结束位置')
    }
  }

  // 处理起始页
  console.log('[PDF Debug] 处理起始页矩形...')
  const startSelected: number[][] = []
  mergeRects(range).forEach((r, i) => {
    const relX1 = r.left - startPageRect.x
    const relY1 = r.top - startPageRect.y
    const relX2 = r.right - startPageRect.x
    const relY2 = r.bottom - startPageRect.y
    
    console.log(`[PDF Debug] 矩形${i + 1} 相对坐标:`, {
      relX1: relX1.toFixed(2),
      relY1: relY1.toFixed(2),
      relX2: relX2.toFixed(2),
      relY2: relY2.toFixed(2)
    })
    
    const pdfCoords = startViewport.convertToPdfPoint(relX1, relY1)
      .concat(startViewport.convertToPdfPoint(relX2, relY2))
    
    console.log(`[PDF Debug] 矩形${i + 1} PDF坐标:`, pdfCoords.map(v => v.toFixed(2)))
    startSelected.push(pdfCoords)
  })

  // 处理结束页
  const endSelected: number[][] = []
  if (startIndex !== endIndex) {
    console.log('[PDF Debug] 处理结束页矩形...')
    const endPage = pages.get(endIndex + 1)
    const endCanvas = endPageElement.querySelector('canvas')
    
    if (!endPage || !endCanvas) {
      console.log('[PDF Debug] ❌ 无法获取结束页对象或canvas')
      return null
    }

    const endPageRect = endCanvas.getBoundingClientRect()
    const endViewport = endPage.getViewport({ scale: viewer.getScale(), rotation: 0 })

    // 从页首开始
    const textLayer = endPageElement.querySelector('.textLayer') as HTMLElement
    const firstNode = textLayer && getTextNode(textLayer, true)
    if (firstNode) cloneRange.setStart(firstNode, 0)

    mergeRects(cloneRange).forEach(r => {
      endSelected.push(
        endViewport.convertToPdfPoint(r.left - endPageRect.x, r.top - endPageRect.y)
          .concat(endViewport.convertToPdfPoint(r.right - endPageRect.x, r.bottom - endPageRect.y))
      )
    })
    
    console.log('[PDF Debug] 结束页矩形数量:', endSelected.length)
  }

  // 生成结果
  const id = generateId()
  const results: PdfAnnotation[] = []
  
  if (startSelected.length) {
    results.push({
      id,
      index: startIndex,
      coords: startSelected,
      color,
      content,
      type: 'text',
      mode: 'text'
    })
  }
  
  if (endSelected.length) {
    results.push({
      id,
      index: endIndex,
      coords: endSelected,
      color,
      content,
      type: 'text',
      mode: 'text'
    })
  }

  console.log('[PDF Debug] ========== 最终结果 ==========')
  console.log('[PDF Debug] 总矩形数:', startSelected.length + endSelected.length)
  console.log('[PDF Debug] 结果:', results)
  console.log('[PDF Debug] =====================================')

  return results.length ? results : null
}

/**
 * getPdfSelectionRects - 供MarkManager调用
 */
export const getPdfSelectionRects = (pdfViewer: any): any[] | null => {
  const sel = window.getSelection()
  if (!sel?.rangeCount || !sel.getRangeAt(0).toString().trim()) return null

  try {
    const range = sel.getRangeAt(0)
    const results = getHighlightCoordsByRange(pdfViewer, range, '#ffeb3b')
    if (!results) return null
    
    // 转换坐标格式
    return results.flatMap((r: any) =>
      r.coords.map((c: number[]) => ({
        x: c[0],
        y: c[1],
        w: c[2] - c[0],
        h: c[3] - c[1]
      }))
    )
  } catch (e) {
    console.error('[PDF Annotation] Error:', e)
    return null
  }
}

/**
 * handlePdfSelection - 处理选择事件
 */
export const handlePdfSelection = (
  viewer: any,
  markManager: any,
  showMenu: (data: any, x: number, y: number) => void
) => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim()) return

  try {
    const range = sel.getRangeAt(0)
    
    console.log('[PDF Selection] ========== 开始处理选择 ==========')
    console.log('[PDF Selection] 选中文本:', sel.toString().substring(0, 50))
    
    // 检查是否在PDF容器内
    if (!hasClosestByClassName(range.commonAncestorContainer, 'viewer-container') &&
        !hasClosestByClassName(range.commonAncestorContainer, 'pdf-page') &&
        !hasClosestByClassName(range.commonAncestorContainer, 'page')) {
      console.log('[PDF Selection] ❌ 不在PDF容器内')
      return
    }
    
    const rects = Array.from(range.getClientRects())
    if (!rects.length) {
      console.log('[PDF Selection] ❌ 没有矩形')
      return
    }
    
    const pageEl = hasClosestByClassName(range.startContainer, 'pdf-page') || 
                   hasClosestByClassName(range.startContainer, 'page')
    if (!pageEl) {
      console.log('[PDF Selection] ❌ 找不到页面元素')
      return
    }
    
    const pg = parseInt(pageEl.getAttribute('data-page') || pageEl.getAttribute('data-page-number') || '1')
    console.log('[PDF Selection] ✓ 页码:', pg)
    
    const page = viewer.getPages().get(pg)
    if (!page) {
      console.log('[PDF Selection] ❌ 无法获取页面对象')
      return
    }
    
    const text = sel.toString().trim()
    let rectsData = markManager?.getPdfSelectionRects()
    
    console.log('[PDF Selection] 从MarkManager获取的矩形:', rectsData)
    
    if (!rectsData) {
      console.log('[PDF Selection] 使用fallback方法计算矩形')
      const pr = pageEl.getBoundingClientRect()
      const vp = page.getViewport({ scale: viewer.getScale(), rotation: viewer.getRotation() })
      rectsData = rects.map(r => {
        const [x1, y1] = vp.convertToPdfPoint(r.left - pr.left, r.top - pr.top)
        const [x2, y2] = vp.convertToPdfPoint(r.right - pr.left, r.bottom - pr.top)
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
      })
    }
    
    console.log('[PDF Selection] ========== 显示菜单 ==========')
    showMenu(
      { text, location: { format: 'pdf', page: pg, rects: rectsData } },
      rects[0].left + rects[0].width / 2,
      rects[0].top
    )
  } catch (e) {
    console.error('[PDF Selection] Error:', e)
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取元素的DOM路径（用于调试）
 */
function getElementPath(node: Node): string {
  const path: string[] = []
  let current: Node | null = node
  
  while (current && current !== document.body) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement
      let selector = el.tagName.toLowerCase()
      if (el.id) selector += `#${el.id}`
      if (el.className) selector += `.${el.className.split(' ').join('.')}`
      path.unshift(selector)
    } else if (current.nodeType === Node.TEXT_NODE) {
      path.unshift(`#text("${current.textContent?.substring(0, 20)}...")`)
    }
    current = current.parentNode
  }
  
  return path.join(' > ')
}
