const CircularProgress = ({ 
    value = 0, 
    size = 40, 
    strokeWidth = 4,
    color = "blue"
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const dash = (value * circumference) / 100; 
  
    const getColor = () => {
      if (color === "green") return "text-green-500";
      if (color === "amber") return "text-amber-500";
      if (color === "red") return "text-red-500";
      return "text-blue-500";
    };
  
    return (
      <div className="relative inline-flex" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            className="text-gray-200"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - dash}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{
              transformOrigin: "50% 50%",
              transform: "rotate(-90deg)",
              transition: "stroke-dashoffset 0.35s",
            }}
          />
        </svg>
        <span className="absolute top-1/2 left-1/2 p-1 transform -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium">
          {Math.round(value)}%
        </span>
      </div>
    );
  };

  export default CircularProgress;