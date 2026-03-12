import { useNavigate } from 'react-router-dom'

export function HomeScreen() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-between h-full bg-black px-6 py-12">
      {/* Logo / titre */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <img src="/assets/logo-mirokai.png" alt="Logo Mirokaï" className="w-28 object-contain" />
        <h1 className="text-3xl font-bold tracking-widest text-center text-white uppercase">
          Mirokaï Experience
        </h1>
        <p className="text-sm tracking-widest text-yellow-400 uppercase font-bold">
          Le jeu
        </p>
      </div>

      {/* Bouton démarrer */}
      <div className="flex flex-col items-center gap-6 w-full">
        <button
          onClick={() => navigate('/game')}
          className="w-full max-w-xs py-4 rounded-none border-2 border-white text-white text-sm tracking-widest uppercase font-bold active:bg-white active:text-black transition-colors"
        >
          ▶ Démarrer
        </button>
        <p className="text-xs text-gray-600 text-center">
          Utilisez les boutons pour vous déplacer<br />dans la Mirokaï Experience
        </p>
      </div>
    </div>
  )
}
