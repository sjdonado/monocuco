import React from 'react';

import icon from '../../icon.jpg';

const Header = function Header() {
  return (
    <>
      <img
        className="icon"
        src={icon}
        alt="Bailarina - Carnaval de Barranquilla, Colombia | Ilustración Andrés Urquina Sánchez"
      />
      <div className="title">
        <h1>Monocuco</h1>
        <h5>Diccionario de palabras y frases costeñas</h5>
      </div>
    </>
  );
};

export default Header;
