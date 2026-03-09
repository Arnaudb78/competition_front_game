import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GameScreen } from './screens/GameScreen'
import { HomeScreen } from './screens/HomeScreen'
import { DesktopBlock } from './screens/DesktopBlock'

const isDev = import.meta.env.VITE_APP_ENV === 'development'
const isMobile = isDev || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
  navigator.userAgent,
)

function App() {
  if (!isMobile) return <DesktopBlock />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/game" element={<GameScreen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
