import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";

const AuthCallbackPage = () => {
  const { checkAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      await checkAuth();
      navigate("/dashboard", { replace: true });
    };
    handle();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Signing you in...
      </div>
    </div>
  );
};

export default AuthCallbackPage;
