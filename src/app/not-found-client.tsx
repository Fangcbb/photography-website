"use client";

export default function NotFoundClient() {
  return (
    <div className="not-found-page">
      <div className="block404">
        <div className="waves"></div>
        <div className="obj">
          <img src="/404-obj.png" alt="" />
        </div>
        <div className="t404"></div>

        <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
          <defs>
            <filter id="glitch">
              <feTurbulence type="fractalNoise" baseFrequency="0.01 0.03" numOctaves="1" result="warp" id="turb"/>
              <feColorMatrix in="warp" result="huedturb" type="hueRotate" values="90">
                <animate attributeType="XML" attributeName="values" values="0;180;360" dur="3s" repeatCount="indefinite"/>
              </feColorMatrix>
              <feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="50" in="SourceGraphic" in2="huedturb"/>
            </filter>
          </defs>
        </svg>
      </div>

      <style jsx>{`
        .not-found-page {
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0a0a1a;
          overflow: hidden;
        }

        .block404 {
          position: relative;
          background-image: url(/404-bg.jpg);
          width: 100%;
          height: 100%;
          overflow: hidden;
          cursor: pointer;
          background-size: cover;
          background-position: center;
        }

        .t404 {
          position: absolute;
          width: 364px;
          height: 146px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-image: url(/404-text.png);
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
        }

        .obj {
          width: 204px;
          height: 209px;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: animation-404 6s infinite ease-in-out;
          z-index: 10;
        }

        .obj img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        @keyframes animation-404 {
          0%, 100% {
            transform: translate(-50%, -50%) rotate(0);
          }
          50% {
            transform: translate(-53%, -42%) rotate(-5deg);
          }
        }

        .waves {
          position: absolute;
          width: 100%;
          height: 100%;
          background-image: url(/404-bg.jpg);
          background-size: cover;
          background-position: center;
          filter: url("#glitch");
        }

        @media (max-width: 768px) {
          .t404 {
            width: 250px;
            height: 100px;
          }

          .obj {
            width: 140px;
            height: 140px;
          }
        }
      `}</style>
    </div>
  );
}
