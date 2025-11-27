import { Routes, Route } from "react-router-dom";

// Pages
import Homepage from "./pages/Home";
import About from "./pages/About";
import LoginKaew from "./pages/LoginKaew";
import VoiceStudio from "./pages/Voice";
// import CallCenter from "./pages/VadComponent";
import MyComponent from "./pages/vad";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute";


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/about" element={<About />} />
      <Route path="/login/kaew" element={<LoginKaew />} />
      <Route path="/voice" element={
        <PrivateRoute>
          <VoiceStudio />
        </PrivateRoute>
    } />
      <Route path="/callcenter" element={<MyComponent />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}