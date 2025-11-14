import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface PhotoUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  maxFiles?: number
  maxSizeMB?: number
}

const MAX_FILE_SIZE_MB = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

export default function PhotoUploader({
  value = [],
  onChange,
  maxFiles = 5,
  maxSizeMB = MAX_FILE_SIZE_MB,
}: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setError(null)

    // Check file count
    if (value.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Validate and upload files
    const uploadPromises: Promise<string>[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`File ${file.name} is not a valid image (JPG/PNG only)`)
        continue
      }

      // Check file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File ${file.name} exceeds ${maxSizeMB}MB limit`)
        continue
      }

      uploadPromises.push(uploadFile(file))
    }

    if (uploadPromises.length === 0) return

    setUploading(true)
    try {
      const urls = await Promise.all(uploadPromises)
      onChange([...value, ...urls])
    } catch (err: any) {
      setError(err.message || 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `bundle-proofs/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('bundle-proofs')
      .upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage
      .from('bundle-proofs')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const removePhoto = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index)
    onChange(newUrls)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop photos here, or{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-500"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPG/PNG only, max {maxSizeMB}MB per file, up to {maxFiles} files
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {uploading && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-600">
          Uploading...
        </div>
      )}

      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {value.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url}
                alt={`Proof ${index + 1}`}
                className="w-full h-32 object-cover rounded-md border border-gray-300"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
