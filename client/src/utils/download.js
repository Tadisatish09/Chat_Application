/**
 * Utility to download media files directly from Blob or Cloudinary URL
 */
export async function downloadMediaFile(mediaUrl, defaultName = 'attachment') {
  if (!mediaUrl) return;

  try {
    // If it's a relative URL, ensure it points to the backend /uploads if not proxied
    const fetchUrl = mediaUrl.startsWith('http') ? mediaUrl : mediaUrl;

    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('File not accessible');

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const filename = mediaUrl.split('/').pop().split('?')[0] || defaultName;

    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);
  } catch (err) {
    console.warn('Direct blob download failed, opening in new tab fallback:', err);
    window.open(mediaUrl, '_blank');
  }
}
