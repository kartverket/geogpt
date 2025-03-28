interface GeoNorgeIconProps {
    className?: string;
  }
  
  const GeoNorgeIcon = ({ className = "w-8 h-8" }: GeoNorgeIconProps) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 42 55"
        role="img"
        aria-labelledby="GeonorgeIconTitle"
        className={className}
      >
        <title id="GeonorgeIconTitle">Geonorge Icon</title>
        <defs>
          <style>
            {`
                .cls-1{fill:#4d4d4f;}
                .cls-2{fill:#a6a8ab;}
                .cls-3{fill:#bbbdbf;}
                .cls-4{fill:#6d6e70;}
                .cls-5{fill:#929497;}
                .cls-6{fill:#fe5000;}
              `}
          </style>
        </defs>
        {/* Diamond shape polygons */}
        <polygon
          className="cls-1"
          points="20.9 30.4 20.9 54.5 0 42.4 20.9 30.4"
        ></polygon>
        <polygon
          className="cls-2"
          points="20.9 6.3 20.9 30.4 0 18.3 20.9 6.3"
        ></polygon>
        <polyline
          className="cls-3"
          points="20.9 30.4 41.8 42.4 41.8 18.3 20.9 30.4"
        ></polyline>
        <polyline
          className="cls-4"
          points="20.9 30.4 0 42.4 0 18.3 20.9 30.4"
        ></polyline>
        <polyline
          className="cls-5"
          points="20.9 30.4 20.9 54.5 41.8 42.4 20.9 30.4"
        ></polyline>
        {/* Orange circle/location marker */}
        <path
          className="cls-6"
          d="M24.5,9.1a8.08,8.08,0,0,1,1.2-4.7,8.78,8.78,0,0,1,15.2,8.8,9.49,9.49,0,0,1-3.5,3.4L24.5,24Zm13,2.1a4.8,4.8,0,0,0-1.8-6.7A4.93,4.93,0,0,0,29,6.3a4.84,4.84,0,0,0-.7,2.6A5,5,0,0,0,30.8,13a4.84,4.84,0,0,0,4.8.1A3.9,3.9,0,0,0,37.5,11.2Z"
        ></path>
      </svg>
    );
  };
  
  export default GeoNorgeIcon;