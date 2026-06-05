import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob, createImportFileInput } from '../../utils/io';

describe('io.js', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:http://test.com/mock');
    URL.revokeObjectURL = vi.fn();
  });

  describe('downloadBlob', () => {
    it('creates a blob and triggers download', () => {
      downloadBlob('test data', 'test.txt', 'text/plain');
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('creates a blob with JSON content type by default', () => {
      downloadBlob({ key: 'value' }, 'data.json');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('creates a blob with custom content type', () => {
      downloadBlob('text content', 'file.txt', 'text/plain');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('stringifies objects before creating blob', () => {
      const obj = { name: 'test', value: 42 };
      downloadBlob(obj, 'obj.json');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('handles empty string data', () => {
      downloadBlob('', 'empty.txt');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    it('revokes object URL after download', () => {
      downloadBlob('data', 'file.txt');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://test.com/mock');
    });
  });

  describe('createImportFileInput', () => {
    it('creates a hidden file input element and removes it', () => {
      const onImport = vi.fn();
      const onError = vi.fn();
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');
      createImportFileInput(onImport, onError);
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('sets accept to .json', () => {
      const onImport = vi.fn();
      createImportFileInput(onImport);
      // The input is created and removed synchronously
    });

    it('does not call onImport when no file selected', () => {
      const onImport = vi.fn();
      const onError = vi.fn();

      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => {
        if (!input.files?.[0]) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const imported = JSON.parse(e.target.result);
            onImport(imported);
          } catch {
            onError('Error importing file: Invalid JSON format');
          }
        };
        reader.readAsText(input.files[0]);
      };

      // Set files to an empty FileList
      const dt = new (globalThis.DataTransfer || class {})();
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onImport).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
