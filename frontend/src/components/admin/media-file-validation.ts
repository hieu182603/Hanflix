/** Check the supported container signatures as well as the upload API's MIME types. */
export async function validateMediaFile(file: File, allowAudio: boolean): Promise<boolean> {
  const acceptedTypes = ['video/mp4', 'video/webm', ...(allowAudio
    ? ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'] : [])];
  if (!acceptedTypes.includes(file.type)) return false;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const header = new Uint8Array(reader.result as ArrayBuffer);
      const matches = (offset: number, bytes: number[]) =>
        bytes.every((byte, index) => header[offset + index] === byte);
      const isMp4 = matches(4, [0x66, 0x74, 0x79, 0x70]); // ftyp
      const isWebm = matches(0, [0x1a, 0x45, 0xdf, 0xa3]);
      const isWav = matches(0, [0x52, 0x49, 0x46, 0x46]) && matches(8, [0x57, 0x41, 0x56, 0x45]);
      const isMp3 = matches(0, [0x49, 0x44, 0x33]) || (
        header.length >= 4 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0
        && (header[1] & 0x18) !== 0x08 && (header[1] & 0x06) !== 0
        && (header[2] & 0xf0) !== 0xf0 && (header[2] & 0x0c) !== 0x0c
      );
      switch (file.type) {
        case 'video/mp4':
        case 'audio/mp4': resolve(isMp4); break;
        case 'video/webm': resolve(isWebm); break;
        case 'audio/mpeg': resolve(isMp3); break;
        default: resolve(isWav);
      }
    };
    reader.onerror = () => resolve(false);
    reader.onabort = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 12));
  });
}
