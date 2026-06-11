import { Loader2 } from "lucide-react";
import React from "react";
const LoadingState = () => {
  return (
    <div className="w-full flex justify-center items-center">
      <div className="w-14 h-14  shadow-md rounded-full flex justify-center items-center  ">
        <Loader2 size={30} className="animate-spin " />
      </div>
    </div>
  );
};

export default LoadingState;
