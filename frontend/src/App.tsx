import { Route, Routes } from "react-router-dom";
import BackgroundMusic from "./components/BackgroundMusic";
import { HandDrawnPressFilters } from "./components/HandDrawnPressButton";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AiStudio from "./pages/AiStudio";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Portfolio from "./pages/Portfolio";
import PortfolioDetail from "./pages/PortfolioDetail";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import Community from "./pages/Community";
import CommunityEditor from "./pages/CommunityEditor";
import CommunityPostDetail from "./pages/CommunityPostDetail";
import CommunityNotifications from "./pages/CommunityNotifications";
import Messages from "./pages/Messages";
import ConversationView from "./pages/ConversationView";
import Search from "./pages/Search";
import Profile from "./pages/Profile";
import ProfileCollectionDetail from "./pages/ProfileCollectionDetail";
import Practice from "./pages/Practice";
import PracticeAdd from "./pages/PracticeAdd";
import PracticeReplace from "./pages/PracticeReplace";
import PracticeSession from "./pages/PracticeSession";

export default function App() {
  return (
    <>
      <HandDrawnPressFilters />
      <BackgroundMusic />
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/practice/add" element={<ProtectedRoute><PracticeAdd /></ProtectedRoute>} />
        <Route path="/practice/:sessionId/replace" element={<ProtectedRoute><PracticeReplace /></ProtectedRoute>} />
        <Route path="/practice/:sessionId" element={<ProtectedRoute><PracticeSession /></ProtectedRoute>} />
        <Route path="/practice" element={<ProtectedRoute><Practice /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/users/:userId" element={<Profile />} />
        <Route path="/users/:userId/collections/:collectionId" element={<ProfileCollectionDetail />} />
        <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
        <Route path="/portfolio/:id" element={<ProtectedRoute><PortfolioDetail /></ProtectedRoute>} />
        <Route path="/ai" element={<ProtectedRoute><AiStudio /></ProtectedRoute>} />
        <Route path="/community" element={<Community />} />
        <Route path="/community/post/create" element={<ProtectedRoute><CommunityEditor /></ProtectedRoute>} />
        <Route path="/community/post/:id/edit" element={<ProtectedRoute><CommunityEditor /></ProtectedRoute>} />
        <Route path="/community/post/:id" element={<CommunityPostDetail />} />
        <Route path="/community/notifications" element={<ProtectedRoute><CommunityNotifications /></ProtectedRoute>} />
        <Route path="/community/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>}>
          <Route path=":conversationId" element={<ConversationView />} />
        </Route>
        <Route path="/community/search" element={<Search />} />
      </Route>
    </Routes>
    </>
  );
}
