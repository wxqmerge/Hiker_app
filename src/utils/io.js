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

// Returns a file input element that triggers a callback with parsed JSON
export function createImportFileInput(onImport, onError) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  input.onchange = () => {
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        onImport(imported);
      } catch {
        onError?.('Error importing file: Invalid JSON format');
      }
    };
    reader.readAsText(input.files[0]);
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}
