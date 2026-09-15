import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { CityProvider } from "@/context/CityContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Home from "@/pages/customer/Home";
import Search from "@/pages/customer/Search";
import RestaurantPage from "@/pages/customer/RestaurantPage";
import Cart from "@/pages/customer/Cart";
import Checkout from "@/pages/customer/Checkout";
import OrderTracking from "@/pages/customer/OrderTracking";
import Orders from "@/pages/customer/Orders";
import Favorites from "@/pages/customer/Favorites";
import Profile from "@/pages/customer/Profile";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";

import MerchantDashboard from "@/pages/merchant/MerchantDashboard";
import MerchantOrders from "@/pages/merchant/MerchantOrders";
import MerchantMenu from "@/pages/merchant/MerchantMenu";
import MerchantCoupons from "@/pages/merchant/MerchantCoupons";
import MerchantLogistics from "@/pages/merchant/MerchantLogistics";
import MerchantFinance from "@/pages/merchant/MerchantFinance";
import MerchantReviews from "@/pages/merchant/MerchantReviews";
import MerchantSettings from "@/pages/merchant/MerchantSettings";
import MerchantIntegrations from "@/pages/merchant/MerchantIntegrations";
import Landing from "@/pages/site/Landing";
import DevDocs from "@/pages/site/DevDocs";
import Splash from "@/components/Splash";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminRestaurants from "@/pages/admin/AdminRestaurants";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminCities from "@/pages/admin/AdminCities";
import AdminMarketing from "@/pages/admin/AdminMarketing";
import AdminFinance from "@/pages/admin/AdminFinance";
import AdminSystem from "@/pages/admin/AdminSystem";
import AdminLeads from "@/pages/admin/AdminLeads";

function App() {
  return (
    <AuthProvider>
      <CityProvider>
        <CartProvider>
          <BrowserRouter>
            <Toaster position="top-center" richColors />
            <Splash />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dev" element={<DevDocs />} />
              <Route path="/app" element={<Home />} />
              <Route path="/buscar" element={<Search />} />
              <Route path="/restaurante/:id" element={<RestaurantPage />} />
              <Route path="/carrinho" element={<Cart />} />
              <Route path="/checkout" element={<ProtectedRoute roles={["customer", "admin"]}><Checkout /></ProtectedRoute>} />
              <Route path="/pedido/:id" element={<ProtectedRoute roles={["customer", "admin"]}><OrderTracking /></ProtectedRoute>} />
              <Route path="/pedidos" element={<ProtectedRoute roles={["customer", "admin"]}><Orders /></ProtectedRoute>} />
              <Route path="/favoritos" element={<ProtectedRoute roles={["customer", "admin"]}><Favorites /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/cadastrar" element={<Register />} />
              <Route path="/esqueci-senha" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route path="/lojista" element={<ProtectedRoute roles={["restaurant"]}><MerchantDashboard /></ProtectedRoute>} />
              <Route path="/lojista/pedidos" element={<ProtectedRoute roles={["restaurant"]}><MerchantOrders /></ProtectedRoute>} />
              <Route path="/lojista/cardapio" element={<ProtectedRoute roles={["restaurant"]}><MerchantMenu /></ProtectedRoute>} />
              <Route path="/lojista/logistica" element={<ProtectedRoute roles={["restaurant"]}><MerchantLogistics /></ProtectedRoute>} />
              <Route path="/lojista/cupons" element={<ProtectedRoute roles={["restaurant"]}><MerchantCoupons /></ProtectedRoute>} />
              <Route path="/lojista/financeiro" element={<ProtectedRoute roles={["restaurant"]}><MerchantFinance /></ProtectedRoute>} />
              <Route path="/lojista/avaliacoes" element={<ProtectedRoute roles={["restaurant"]}><MerchantReviews /></ProtectedRoute>} />
              <Route path="/lojista/configuracoes" element={<ProtectedRoute roles={["restaurant"]}><MerchantSettings /></ProtectedRoute>} />
              <Route path="/lojista/integracoes" element={<ProtectedRoute roles={["restaurant"]}><MerchantIntegrations /></ProtectedRoute>} />

              <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/restaurantes" element={<ProtectedRoute roles={["admin"]}><AdminRestaurants /></ProtectedRoute>} />
              <Route path="/admin/clientes" element={<ProtectedRoute roles={["admin"]}><AdminCustomers /></ProtectedRoute>} />
              <Route path="/admin/cidades" element={<ProtectedRoute roles={["admin"]}><AdminCities /></ProtectedRoute>} />
              <Route path="/admin/marketing" element={<ProtectedRoute roles={["admin"]}><AdminMarketing /></ProtectedRoute>} />
              <Route path="/admin/financeiro" element={<ProtectedRoute roles={["admin"]}><AdminFinance /></ProtectedRoute>} />
              <Route path="/admin/sistema" element={<ProtectedRoute roles={["admin"]}><AdminSystem /></ProtectedRoute>} />
              <Route path="/admin/leads" element={<ProtectedRoute roles={["admin"]}><AdminLeads /></ProtectedRoute>} />

              <Route path="*" element={<Home />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </CityProvider>
    </AuthProvider>
  );
}

export default App;
