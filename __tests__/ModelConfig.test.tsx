import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ModelConfig from '../src/pages/ModelConfig';
import { apiFetch } from '../src/utils/api';
import '@testing-library/jest-dom';

// Mock Dependencies
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);
jest.mock('../src/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id', name: 'Test User' },
        loading: false,
    }),
}));

// Mock Child Components
jest.mock('../src/components/workflow/WorkflowCanvas', () => (props: any) => (
    <div data-testid="workflow-canvas">
        Nodes: {props.nodes?.length}
        <button onClick={() => props.onNodeSelect && props.onNodeSelect('1')}>Select Node 1</button>
    </div>
));
jest.mock('../src/components/workflow/NodeSidebar', () => () => <div data-testid="node-sidebar">Node Sidebar</div>);
jest.mock('../src/components/workflow/config', () => ({
    AIModelConfigPanel: () => <div data-testid="ai-config">AI Config</div>,
    RAGDocumentConfigPanel: () => <div data-testid="rag-config">RAG Config</div>,
    GoogleSheetsConfigPanel: () => <div data-testid="sheets-config">Sheets Config</div>,
}));
jest.mock('../src/components/workflow/config/IfConditionConfigPanel', () => () => <div data-testid="condition-config">Condition Config</div>);

// Mock API
jest.mock('../src/utils/api', () => ({
    apiFetch: jest.fn(),
}));

jest.mock('sweetalert2', () => ({
    fire: jest.fn(),
}));

describe('ModelConfig', () => {
    const projectId = 'test-project-id';

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock API responses
        (apiFetch as jest.Mock).mockImplementation((url) => {
            if (url.endsWith(`/projects/${projectId}`)) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        id: projectId,
                        name: 'Test Project',
                        nodes: [
                            { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Input' } }
                        ],
                        connections: [],
                    }),
                });
            }
            if (url.includes('/api/voices/user')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [],
                });
            }
            if (url.includes('/api/users/test-user-id/api-keys')) {
                 return Promise.resolve({
                    ok: true,
                    json: async () => [],
                });
            }
            return Promise.resolve({ ok: true, json: async () => ({}) });
        });
    });

    it('renders the editor and fetches project data', async () => {
        render(
            <MemoryRouter initialEntries={[`/model-config/${projectId}`]}>
                <Routes>
                    <Route path="/model-config/:projectId" element={<ModelConfig />} />
                </Routes>
            </MemoryRouter>
        );

        // Check loading state or initial render
        // Since we mocked apiFetch to resolve immediately, it might render fast.
        // But ModelConfig might have loading state.
        
        // Wait for project data to be loaded (nodes are rendered in ReactFlow mock)
        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining(`/projects/${projectId}`), expect.any(Object));
        });

        // Check if WorkflowCanvas renders
        expect(await screen.findByTestId('workflow-canvas')).toBeInTheDocument();
        // Check for child components
        expect(screen.getByTestId('node-sidebar')).toBeInTheDocument();
    });

    it('renders sidebar with node types', async () => {
        render(
            <MemoryRouter initialEntries={[`/model-config/${projectId}`]}>
                <Routes>
                    <Route path="/model-config/:projectId" element={<ModelConfig />} />
                </Routes>
            </MemoryRouter>
        );

        // Sidebar content is mocked, so we just check for the mocked component
        expect(await screen.findByTestId('node-sidebar')).toBeInTheDocument();
    });
});
