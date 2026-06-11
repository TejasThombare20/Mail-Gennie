import { useToast } from "../components/ui-component/Use-toast";


interface ApiError {
  status: number;
  message: string;
  data?: any;
}

export const useHandleApiError = () => {
  const { toast } = useToast(); 

  return (error: ApiError) => {
    if ("status" in error) {
      console.error(`Error ${error.status}: ${error.message}`);

      switch (error.status) {
        case 401:
          toast({
            title: "Unauthorized!",
            description: "Please log in again.",
            variant: "destructive",
          });
          break;
        case 403:
          toast({
            title: "Access Denied",
            description: "You don't have permission to access this resource.",
            variant: "destructive",
          });
          break;
        case 404:
          toast({
            title: "Not Found",
            description: "Requested data not found.",
            variant: "destructive",
          });
          break;
        case 0:
          toast({
            title: "Network Error",
            description: error.message, // Handles "No internet connection" or "Server not responding"
            variant: "destructive",
          });
          break;
        default:
          toast({
            title: "Error",
            description: "Something went wrong. Please try again later.",
            variant: "destructive",
          });
      }
    } else {
      console.error("Unexpected Error:", error);
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };
};
