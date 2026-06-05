// Download a blob as a file
export function downloadBlob(data, filename, type = 'application/json') {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Create a hidden file input, trigger it, and call onFile with the selected file
export function createFileInput({ accept, onFile, onCleanup }) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  input.onchange = () => {
    if (!input.files?.[0]) return;
    onFile(input.files[0]);
    document.body.removeChild(input);
    onCleanup?.();
  };
  document.body.appendChild(input);
  input.click();
}

// Returns a file input element that triggers a callback with parsed JSON
export function createImportFileInput(onImport, onError) {
  createFileInput({
    accept: '.json',
    onFile: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          onImport(imported);
        } catch {
          onError?.('Error importing file: Invalid JSON format');
        }
      };
      reader.readAsText(file);
    },
  });
}
