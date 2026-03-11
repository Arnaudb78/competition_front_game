import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { MainScene, type ModuleData, FALLBACK_MODULES } from '../game/MainScene'

interface ModuleInfo { id: number; name: string }

const CONTROLS_H = 160
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'

async function fetchModules(): Promise<ModuleData[] | null> {
  try {
    const res = await fetch(`${API_URL}/modules`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data: { number: number; name: string; mapX?: number; mapY?: number }[] = await res.json()

    // Pour chaque module du fallback, on prend la position API si disponible
    const merged: ModuleData[] = FALLBACK_MODULES.map((fallback) => {
      const api = data.find((m) => m.number === fallback.id)
      if (api?.mapX !== undefined && api?.mapY !== undefined) {
        return {
          id: api.number,
          name: api.name,
          x: Math.round(api.mapX * 48),
          y: Math.round(api.mapY * 44),
        }
      }
      return fallback
    })

    return merged
  } catch {
    return null
  }
}

export function GameScreen() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<MainScene | null>(null)
  const [nearModule, setNearModule] = useState<ModuleInfo | null>(null)
  const [activeModule, setActiveModule] = useState<ModuleInfo | null>(null)
  // undefined = en cours, null = fallback, ModuleData[] = chargé
  const [modules, setModules] = useState<ModuleData[] | null | undefined>(undefined)

  // Étape 1 : fetch
  useEffect(() => {
    fetchModules().then((data) => setModules(data))
  }, [])

  // Étape 2 : créer le jeu une fois les modules connus (plus undefined)
  useEffect(() => {
    if (modules === undefined) return
    if (!containerRef.current || !wrapperRef.current) return

    const scene = new MainScene(modules ?? undefined)
    scene.onNearModule = (mod) => setNearModule(mod)
    scene.onInteract = (mod) => setActiveModule(mod)
    sceneRef.current = scene

    const GAME_H = wrapperRef.current.clientHeight - CONTROLS_H

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: GAME_H,
      backgroundColor: '#0a0a0a',
      parent: containerRef.current,
      scene,
      render: { pixelArt: true, antialias: false },
    })

    return () => { game.destroy(true) }
  }, [modules])

  function pressDir(dx: number, dy: number) {
    sceneRef.current?.setHeldDir(dx, dy)
  }
  function release() {
    sceneRef.current?.clearHeldDir()
  }

  const btnClass =
    'flex items-center justify-center bg-zinc-700 active:bg-zinc-500 active:scale-95 rounded-sm text-white font-bold transition-transform select-none'

  return (
    <div ref={wrapperRef} className="flex flex-col select-none overflow-hidden" style={{ height: '100dvh' }}>
      {modules === undefined && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]">
          <p className="text-purple-400 text-sm animate-pulse">Chargement de l'expérience…</p>
        </div>
      )}
      {/* Écran */}
      <div className="relative bg-[#0f0f1a] shrink-0">
        <div ref={containerRef} />
        {nearModule && !activeModule && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 border border-purple-500 px-3 py-1 text-xs text-purple-300 whitespace-nowrap rounded-sm animate-pulse">
            Module {nearModule.id} · Appuyer A
          </div>
        )}
      </div>

      {/* Popup module */}
      {activeModule && (
        <div className="absolute inset-x-6 top-[20%] z-50 bg-zinc-900 border-2 border-purple-500 p-4 rounded-sm shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-purple-400 text-xs tracking-widest uppercase">
              Module {activeModule.id}
            </span>
            <button onClick={() => setActiveModule(null)} className="text-gray-500 text-xs">
              ✕
            </button>
          </div>
          <p className="text-white font-bold text-sm">{activeModule.name}</p>
          <p className="text-gray-400 text-xs mt-2">
            Approchez-vous de ce module lors de votre visite pour en savoir plus.
          </p>
        </div>
      )}

      {/* Coque Gameboy */}
      <div className="flex flex-col justify-between px-4 py-3 bg-zinc-900 border-t-2 border-zinc-700" style={{ height: CONTROLS_H }}>

        <div className="flex items-center justify-between">
          {/* Croix directionnelle */}
          <div className="grid grid-cols-3 grid-rows-3 gap-0.5 w-32 h-32">
            <div />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(0, -1)}
              onPointerUp={release}
              onPointerLeave={release}
            >▲</button>
            <div />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(-1, 0)}
              onPointerUp={release}
              onPointerLeave={release}
            >◀</button>
            <div className="bg-zinc-600 rounded-sm" />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(1, 0)}
              onPointerUp={release}
              onPointerLeave={release}
            >▶</button>
            <div />
            <button
              className={`${btnClass} text-xl`}
              onPointerDown={() => pressDir(0, 1)}
              onPointerUp={release}
              onPointerLeave={release}
            >▼</button>
            <div />
          </div>

          {/* Boutons A / B */}
          <div className="flex gap-2 items-end mb-2">
            <button
              onPointerDown={() => setActiveModule(null)}
              className="w-10 h-10 rounded-full bg-zinc-600 active:bg-zinc-400 active:scale-95 border-b-4 border-zinc-800 text-white text-xs font-bold shadow-lg transition-transform"
            >
              B
            </button>
            <button
              onPointerDown={() => sceneRef.current?.interact()}
              className="w-12 h-12 rounded-full bg-red-600 active:bg-red-400 active:scale-95 border-b-4 border-red-900 text-white text-sm font-bold shadow-lg transition-transform"
            >
              A
            </button>
          </div>
        </div>

        {/* SELECT / START */}
        <div className="flex justify-center gap-4">
          <button className="px-4 py-0.5 bg-zinc-700 active:bg-zinc-500 rounded-full text-xs text-gray-400">
            SELECT
          </button>
          <button className="px-4 py-0.5 bg-zinc-700 active:bg-zinc-500 rounded-full text-xs text-gray-400">
            START
          </button>
        </div>
      </div>
    </div>
  )
}
