import React, { useState, useEffect, useRef } from 'react';
import { api, getAuthToken, getAgentBaseUrl } from '../services/api.js';
import { ConfirmationDialog } from '../components/ConfirmationDialog.js';
import type { FileEntry } from '@mc-panel/types';
import {
  FolderTree,
  Folder,
  FileText,
  FileCode,
  FileArchive,
  Upload,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit,
  Download,
  ArrowLeft,
  Save,
  X,
  AlertTriangle,
  RefreshCw,
  Lock
} from 'lucide-react';

export const Files: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Text editor state
  const [editingFile, setEditingFile] = useState<{ path: string; name: string; content: string; original: string } | null>(null);

  // New folder / file modals
  const [newFolderInput, setNewFolderInput] = useState<string | null>(null);
  const [newFileInput, setNewFileInput] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {}
  });

  const fetchFiles = async (targetPath = currentPath) => {
    setLoading(true);
    try {
      const res = await api.getFiles(targetPath);
      setCurrentPath(res.currentPath);
      setFiles(res.files);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error reading directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles('');
  }, []);

  const handleOpenFolder = (folderName: string) => {
    const nextPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    fetchFiles(nextPath);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    fetchFiles(parts.join('/'));
  };

  const handleEditFile = async (file: FileEntry) => {
    if (file.isProtected) {
      alert('This file is strictly protected for security.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.getFileContent(file.path);
      setEditingFile({
        path: file.path,
        name: file.name,
        content: res.content,
        original: res.content
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open file for editing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    setActionLoading(true);
    try {
      await api.saveFileContent(editingFile.path, editingFile.content);
      setEditingFile(null);
      await fetchFiles();
      alert('File saved successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (file: FileEntry) => {
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${file.isDirectory ? 'Directory' : 'File'}`,
      message: `Permanently delete "${file.name}"? This action cannot be undone.`,
      action: async () => {
        setActionLoading(true);
        try {
          await api.deletePath(file.path);
          await fetchFiles();
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded || uploaded.length === 0) return;

    setActionLoading(true);
    try {
      await api.uploadFile(currentPath, uploaded[0]);
      await fetchFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setActionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderInput?.trim()) return;
    const target = currentPath ? `${currentPath}/${newFolderInput.trim()}` : newFolderInput.trim();
    try {
      await api.createDirectory(target);
      setNewFolderInput(null);
      await fetchFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileInput?.trim()) return;
    const target = currentPath ? `${currentPath}/${newFileInput.trim()}` : newFileInput.trim();
    try {
      await api.saveFileContent(target, '');
      setNewFileInput(null);
      await fetchFiles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create file');
    }
  };

  const getFileIcon = (file: FileEntry) => {
    if (file.isDirectory) return <Folder className="w-5 h-5 text-amber-400" />;
    if (file.isProtected) return <Lock className="w-5 h-5 text-red-400" />;
    if (['.properties', '.yml', '.yaml', '.json', '.toml'].includes(file.extension || '')) {
      return <FileCode className="w-5 h-5 text-sky-400" />;
    }
    if (['.zip', '.tar', '.gz'].includes(file.extension || '')) {
      return <FileArchive className="w-5 h-5 text-emerald-400" />;
    }
    return <FileText className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <FolderTree className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">FILE MANAGER</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse, edit server properties, view logs, and manage server files safely.
          </p>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            Upload File
          </button>

          <button
            onClick={() => setNewFolderInput('')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            New Folder
          </button>

          <button
            onClick={() => setNewFileInput('')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
          >
            <FilePlus className="w-3.5 h-3.5 text-sky-400" />
            New File
          </button>
        </div>
      </div>

      {/* Directory Breadcrumb Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-mono overflow-x-auto py-1">
          {currentPath ? (
            <button
              onClick={handleGoUp}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition flex items-center gap-1 mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Up
            </button>
          ) : null}

          <button
            onClick={() => fetchFiles('')}
            className="hover:text-emerald-400 font-semibold"
          >
            root
          </button>

          {currentPath.split('/').filter(Boolean).map((part, index, arr) => (
            <React.Fragment key={index}>
              <span className="text-slate-600">/</span>
              <button
                onClick={() => fetchFiles(arr.slice(0, index + 1).join('/'))}
                className="hover:text-emerald-400"
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        <button
          onClick={() => fetchFiles()}
          className="text-slate-400 hover:text-white p-1"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline Create Folder Modal */}
      {newFolderInput !== null && (
        <form onSubmit={handleCreateFolder} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-2">
          <input
            type="text"
            required
            autoFocus
            value={newFolderInput}
            onChange={(e) => setNewFolderInput(e.target.value)}
            placeholder="Folder name..."
            className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
          />
          <button type="submit" className="px-4 py-2 bg-emerald-600 rounded-xl text-xs font-semibold text-white">Create</button>
          <button type="button" onClick={() => setNewFolderInput(null)} className="px-3 py-2 text-slate-400 hover:text-white text-xs">Cancel</button>
        </form>
      )}

      {/* Inline Create File Modal */}
      {newFileInput !== null && (
        <form onSubmit={handleCreateFile} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-2">
          <input
            type="text"
            required
            autoFocus
            value={newFileInput}
            onChange={(e) => setNewFileInput(e.target.value)}
            placeholder="File name (e.g. motd.txt, server.properties)..."
            className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
          />
          <button type="submit" className="px-4 py-2 bg-emerald-600 rounded-xl text-xs font-semibold text-white">Create</button>
          <button type="button" onClick={() => setNewFileInput(null)} className="px-3 py-2 text-slate-400 hover:text-white text-xs">Cancel</button>
        </form>
      )}

      {/* File List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {files.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            {loading ? 'Reading files...' : 'Folder is empty.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {files.map((file) => (
              <div
                key={file.name}
                className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition"
              >
                <div
                  onClick={() => file.isDirectory ? handleOpenFolder(file.name) : file.isEditable ? handleEditFile(file) : null}
                  className={`flex items-center gap-3 flex-1 min-w-0 ${file.isDirectory || file.isEditable ? 'cursor-pointer' : ''}`}
                >
                  {getFileIcon(file)}
                  <div className="truncate">
                    <span className="text-xs font-bold text-white hover:text-emerald-400 transition truncate block">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {file.isDirectory ? 'Directory' : `${(file.sizeBytes / 1024).toFixed(1)} KB`} • {new Date(file.modifiedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {file.isEditable && (
                    <button
                      onClick={() => handleEditFile(file)}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                      title="Edit text"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!file.isDirectory && !file.isProtected && (
                    <a
                      href={`${getAgentBaseUrl()}/api/files/download?path=${encodeURIComponent(file.path)}&token=${encodeURIComponent(getAuthToken() || '')}`}
                      download={file.name}
                      className="p-2 rounded-xl text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(file)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Text / Config File Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <Edit className="w-4 h-4 text-emerald-400" />
                  {editingFile.name}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">{editingFile.path}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveFile}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    if (editingFile.content !== editingFile.original) {
                      if (!confirm('Discard unsaved changes?')) return;
                    }
                    setEditingFile(null);
                  }}
                  className="p-2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Code / Text Area */}
            <div className="flex-1 p-4 bg-slate-950 flex flex-col">
              <textarea
                value={editingFile.content}
                onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                className="flex-1 w-full bg-transparent text-slate-200 font-mono text-xs p-2 outline-none resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog((p) => ({ ...p, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
};
