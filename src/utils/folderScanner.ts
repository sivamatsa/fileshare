export interface ScannedFile {
  file: File;
  relativePath: string;
}

// Recursively traverse FileSystemEntry to extract all files within folders
async function traverseEntry(entry: any, currentPath = ''): Promise<ScannedFile[]> {
  if (!entry) return [];

  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          const relativePath = currentPath ? `${currentPath}/${file.name}` : file.name;
          resolve([{ file, relativePath }]);
        },
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const entries: any[] = [];

    const readEntries = async (): Promise<any[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries(
          (batch: any[]) => {
            if (batch.length === 0) {
              resolve(entries);
            } else {
              entries.push(...batch);
              readEntries().then(resolve);
            }
          },
          () => resolve(entries)
        );
      });
    };

    const childEntries = await readEntries();
    const subPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    const results: ScannedFile[] = [];

    for (const child of childEntries) {
      const subFiles = await traverseEntry(child, subPath);
      results.push(...subFiles);
    }

    return results;
  }

  return [];
}

export async function scanDroppedItems(items: DataTransferItemList | FileList): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  // Check if we have DataTransferItemList with webkitGetAsEntry
  if ('length' in items && items[0] && 'webkitGetAsEntry' in (items[0] as any)) {
    const list = items as DataTransferItemList;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (item.kind === 'file') {
        const entry = (item as any).webkitGetAsEntry?.();
        if (entry) {
          const files = await traverseEntry(entry);
          results.push(...files);
        } else {
          const file = item.getAsFile();
          if (file) {
            results.push({ file, relativePath: file.name });
          }
        }
      }
    }
  } else {
    // Standard FileList fallback
    const fileList = items as FileList;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relPath = (file as any).webkitRelativePath || file.name;
      results.push({ file, relativePath: relPath });
    }
  }

  return results;
}
