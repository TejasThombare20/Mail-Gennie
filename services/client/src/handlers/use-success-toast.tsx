import { useToast } from "../components/ui-component/Use-toast";

export const useSuccessToast = () => {
  const { toast } = useToast(); 

  return (message: string, title: string = "Success") => {
    toast({
      title: title,
      description: message,
      variant: "default", 
    });
  };
};
