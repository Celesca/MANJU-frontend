import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import Homepage from "./pages/Home";
import VoiceStudio from "./pages/Voice";
import Login from "./pages/Login";
import ModelConfig from "./pages/ModelConfig";
import ProjectsContent from "./pages/ProjectsContent";
import VoicesContent from "./pages/VoicesContent";
import CreateVoicePage from "./pages/CreateVoicePage";
import ConsolePage from "./pages/ConsolePage";
import DemoPage from "./pages/DemoPage";
import SettingsPage from "./pages/SettingsPage";
import PrivateRoute from "./components/PrivateRoute";
import FeaturesSection from "./pages/FeaturesSection";
import PricingSection from "./pages/Pricing";
import AboutPage from "./pages/About";

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/features" element={<FeaturesSection />} />
      <Route path="/pricing" element={<PricingSection />} />
      <Route path="/login" element={<Login />} />

      {/* Console Routes - Main dashboard area */}
      <Route path="/console" element={<ConsolePage />}>
        <Route path="projects" element={<ProjectsContent />} />
        <Route path="voices" element={<VoicesContent />} />
        <Route path="voices/create" element={<CreateVoicePage />} />
      </Route>

      {/* Legacy /projects route - redirect to console */}
      <Route path="/projects" element={<Navigate to="/console/projects" replace />} />

      {/* Voice Studio */}
      <Route path="/voice" element={
        <PrivateRoute>
          <VoiceStudio />
        </PrivateRoute>
      } />

      {/* Model Config (standalone page with its own layout) */}
      <Route path="/model-config" element={<ModelConfig />} />
      <Route path="/model-config/:projectId" element={<ModelConfig />} />

      {/* Demo Page */}
      <Route path="/demo/:projectId" element={
        <PrivateRoute>
          <DemoPage />
        </PrivateRoute>
      } />

      {/* Settings */}
      <Route path="/settings" element={
        <PrivateRoute>
          <SettingsPage />
        </PrivateRoute>
      } />
    </Routes>
  );
}
