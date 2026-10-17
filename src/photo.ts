const PHOTO_KEY = 'vms-photo'
const NAME_KEY = 'vms-photo-name'

export type DeskPhoto = { url: string; name: string }

export function loadPhoto(): DeskPhoto | null {
  try {
    const url = sessionStorage.getItem(PHOTO_KEY)
    if (!url) return null
    return { url, name: sessionStorage.getItem(NAME_KEY) || 'Desk photo' }
  } catch {
    return null
  }
}

export function savePhoto(photo: DeskPhoto): boolean {
  try {
    sessionStorage.setItem(PHOTO_KEY, photo.url)
    sessionStorage.setItem(NAME_KEY, photo.name)
    return true
  } catch {
    return false
  }
}

export function clearPhoto(): void {
  try {
    sessionStorage.removeItem(PHOTO_KEY)
    sessionStorage.removeItem(NAME_KEY)
  } catch {
    /* private mode */
  }
}

export function readDeskPhoto(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const maxEdge = 1600
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('canvas'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('image'))
    }
    image.src = objectUrl
  })
}
