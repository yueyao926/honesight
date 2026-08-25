import { lazy, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import BackgroundMusic from "./components/BackgroundMusic";
import { HandDrawnPressFilters } from "./components/HandDrawnPressButton";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import { prefetchCommonRoutes } from "./utils/routePrefetch";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ResendVerification = lazy(() => import("./pages/ResendVerification"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Settings = lazy(() => import("./pages/Settings"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const PortfolioDetail = lazy(() => import("./pages/PortfolioDetail"));
const AiStudio = lazy(() => import("./pages/AiStudio"));
const Community = lazy(() => import("./pages/Community"));
const CommunityEditor = lazy(() => import("./pages/CommunityEditor"));
const CommunityPostDetail = lazy(() => import("./pages/CommunityPostDetail"));
const CommunityNotifications = lazy(() => import("./pages/CommunityNotifications"));
const Messages = lazy(() => import("./pages/Messages"));
const ConversationView = lazy(() => import("./pages/ConversationView"));
const Search = lazy(() => import("./pages/Search"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileCollectionDetail = lazy(() => import("./pages/ProfileCollectionDetail"));
const Practice = lazy(() => import("./pages/Practice"));
const PracticeAdd = lazy(() => import("./pages/PracticeAdd"));
const PracticeReplace = lazy(() => import("./pages/PracticeReplace"));
const PracticeSession = lazy(() => import("./pages/PracticeSession"));

export default function App() {
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => prefetchCommonRoutes());
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(() => prefetchCommonRoutes(), 800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <HandDrawnPressFilters />
      <BackgroundMusic />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/resend-verification" element={<ResendVerification />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
