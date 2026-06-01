import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "@/App.css";
import Layout from "@/components/Layout";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import PlayAI from "@/pages/PlayAI";
import PlayLocal from "@/pages/PlayLocal";
import PlayOnline from "@/pages/PlayOnline";
import Friends from "@/pages/Friends";
import GameReview from "@/pages/GameReview";
import Profile from "@/pages/Profile";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-20 text-center text-zinc-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-20 text-center text-zinc-500">Loading…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function Shell() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/play/ai" element={<Protected><PlayAI /></Protected>} />
        <Route path="/play/local" element={<Protected><PlayLocal /></Protected>} />
        <Route path="/play/online" element={<Protected><PlayOnline /></Protected>} />
        <Route path="/friends" element={<Protected><Friends /></Protected>} />
        <Route path="/game/:id" element={<Protected><GameReview /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/settings" element={<Protected><Settings /></Protected>} />
        <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
