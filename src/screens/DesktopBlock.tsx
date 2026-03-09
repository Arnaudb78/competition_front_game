import { QRCodeSVG } from 'qrcode.react'

export function DesktopBlock() {
  const url = window.location.href

  return (
    <div className="flex flex-col items-center justify-center h-full bg-black text-white text-center px-8 gap-8">
      <div>
        <h1 className="text-xl font-bold tracking-widest uppercase mb-2">
          Mirokaï Experience
        </h1>
        <p className="text-sm text-gray-400">
          Cette expérience est conçue pour mobile.
        </p>
      </div>

      <div className="p-4 bg-white rounded-lg">
        <QRCodeSVG value={url} size={180} />
      </div>

      <p className="text-xs text-gray-500 tracking-widest uppercase">
        Scannez avec votre téléphone
      </p>
    </div>
  )
}
