import { Component, StrictMode } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { STORAGE_KEY } from './services/storage'
import './styles.css'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('课间页面错误', error, info)
  }
  exportRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) ?? '{}'
      const url = URL.createObjectURL(
        new Blob([raw], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = '课间原始数据备份.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      alert('当前浏览器无法读取本地存储，请检查浏览器设置。')
    }
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal">
          <h1>页面暂时无法打开</h1>
          <p>
            可能是本地数据不兼容或浏览器存储不可用。现有数据不会被自动清除。
          </p>
          <button className="primary" onClick={() => location.reload()}>
            重新加载
          </button>
          <button className="secondary" onClick={() => this.exportRaw()}>
            导出原始数据备份
          </button>
        </main>
      )
    return this.props.children
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
