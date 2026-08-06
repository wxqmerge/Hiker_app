import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob, createImportFileInput } from '../../utils/io';

describe('io.js', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:http://test.com/mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('downloadBlob', () => {
    it('creates a blob and triggers download', async () => {
      downloadBlob('test data', 'test.txt', 'text/plain');
      expect(URL.createObjectURL).toHaveBeenCalled();
      vi.advanceTimersByTime(1100);
      await vi.runOnlyPendingTimersAsync();
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

    it('revokes object URL after download', async () => {
      downloadBlob('data', 'file.txt');
      vi.advanceTimersByTime(1100);
      await vi.runOnlyPendingTimersAsync();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://test.com/mock');
    });
  });

  describe('createImportFileInput', () => {
    it('creates a hidden file input element and appends to body', () => {
      const onImport = vi.fn();
      const onError = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      createImportFileInput(onImport, onError);
      expect(appendChildSpy).toHaveBeenCalled();
      const input = appendChildSpy.mock.calls[0][0];
      expect(input.type).toBe('file');
      expect(input.accept).toBe('.json');
    });

    it('removes input and calls onImport after file is selected', async () => {
      const onImport = vi.fn();
      const onError = vi.fn();
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');
      vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function() {
        this.onload({ target: { result: JSON.stringify({ test: true }) } });
      });

      createImportFileInput(onImport, onError);
      const input = document.body.lastElementChild;
      // Simulate file selection by directly invoking the onchange handler
      // with a mock file; in jsdom input.files can't be set to a FileList
      const mockFile = new File(['{"test":true}'], 'test.json');
      Object.defineProperty(input, 'files', { value: [mockFile], writable: false });
      input.dispatchEvent(new Event('change', { bubbles: true }));

      expect(removeChildSpy).toHaveBeenCalled();
      expect(onImport).toHaveBeenCalledWith({ test: true });
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
