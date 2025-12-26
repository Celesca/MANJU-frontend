import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FolderOpen,
  Settings,
  Trash2,
  Play,
  Clock,
  Search,
  MoreVertical,
  ChevronLeft,
  Edit2
} from 'lucide-react';
import Swal from 'sweetalert2';
import Navbar from '../components/Navbar';
import { apiFetch } from '../utils/api';

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
  updated_at: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`${API_BASE}/api/projects`, {
          credentials: 'include',
        });
        if (!res.ok) {
          if (res.status === 401) {
            navigate('/login');
            return;
          }
          throw new Error('Failed to fetch projects');
        }
        const data = await res.json();
        setProjects(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [navigate]);

  // Warn on unload if editing unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (editingId) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editingId]);

  const createProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      setCreating(true);
      const res = await apiFetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
          nodes: [],
          connections: [],
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create project');
      }

      const newProject = await res.json();
      setProjects((prev) => [newProject, ...prev]);
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDescription('');

      // Navigate to the new project
      navigate(`/model-config/${newProject.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      const res = await apiFetch(`${API_BASE}/api/projects/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to delete project');
      }

      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const startRename = (projectId: string, currentName: string) => {
    setEditingId(projectId);
    setEditingName(currentName);
    setMenuOpenId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveRename = async (projectId: string) => {
    if (!editingName.trim()) return;
    try {
      setSavingEdit(true);
      const res = await apiFetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editingName }),
      });
      if (!res.ok) throw new Error('Failed to save project name');
      const updated = await res.json();
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
      setEditingId(null);
      setEditingName('');
      Swal.fire({ icon: 'success', title: 'Saved', text: 'Project name saved.' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingEdit(false);
    }
  };

  // Navigate with unsaved guard: shows SweetAlert with options Save / Leave without saving / Cancel
  const navigateWithGuard = async (to: string, _projectId?: string) => {
    if (!editingId) {
      navigate(to);
      return;
    }

    const result = await Swal.fire({
      title: 'Unsaved changes',
      text: 'You have unsaved changes. What would you like to do?',
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Save changes',
      denyButtonText: `Leave without saving`,
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      // Save then navigate
      await saveRename(editingId!);
      navigate(to);
    } else if (result.isDenied) {
      // Discard and navigate
      cancelRename();
      navigate(to);
    } else {
      // Cancel - stay
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'archived':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link to="/" className="text-gray-500 hover:text-gray-700 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">My Projects</h1>
            </div>
            <p className="text-gray-600">Manage your voice workflow projects</p>
          </div>

          <motion.button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-semibold shadow-lg shadow-purple-200 hover:bg-purple-700 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-5 h-5" />
            New Project
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProjects.length === 0 && (
          <div className="text-center py-20">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first voice workflow project to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Project
              </button>
            )}
          </div>
        )}

        {/* Projects Grid */}
        {!loading && filteredProjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <motion.div
                key={project.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {editingId === project.id ? (
                          <input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded-md text-gray-900 w-full"
                          />
                        ) : (
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {project.name}
                          </h3>
                        )}

                        {!editingId && (
                          <button
                            title="Rename project"
                            onClick={() => startRename(project.id, project.name)}
                            className="p-1 hover:bg-gray-100 rounded-md"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {project.description || 'No description'}
                      </p>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === project.id ? null : project.id)}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>

                      <AnimatePresence>
                        {menuOpenId === project.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-8 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
                          >
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                // navigate with guard in case there's an active rename
                                navigateWithGuard(`/model-config/${project.id}`);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Settings className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                deleteProject(project.id);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatDate(project.updated_at || project.created_at)}
                    </span>
                  </div>
                </div>

                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                  {editingId === project.id ? (
                    <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2">
                      <button
                        onClick={() => cancelRename()}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Don't Save
                      </button>
                      <button
                        onClick={() => saveRename(project.id)}
                        disabled={savingEdit || !editingName.trim()}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingEdit ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => navigateWithGuard(`/model-config/${project.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Open Editor
                    </button>
                  )}
                  <button
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    title="Run workflow"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Project</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="My Voice Workflow"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    placeholder="Describe your workflow..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={!newProjectName.trim() || creating}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
