# Monocuco
Diccionario abierto y gratuito de [Español barranquillero](https://es.wikipedia.org/wiki/Espa%C3%B1ol_barranquillero).

## ¿Cómo contribuir?

Antes de escribir una definición, por favor revisa nuestras [pautas de contenido](https://monocuco.sjdonado.com/guidelines). En resumen: comparte definiciones útiles para otras personas y nunca publiques discursos de odio ni información personal.

Tienes dos formas de aportar nuevas palabras al diccionario:

### 1. Usar el CLI

Requisitos: Node.js (o [Bun](https://bun.sh/)).

```sh
bun install

bun run add-word -- \
  --word "Jodido" \
  --definition "Persona que está mal" \
  --example "Quedé jodido con ese aguacero" \
  --author "Wilson Tovar" \
  --website "https://github.com/krthr"
```

El comando actualizará `data.json` y el README automáticamente. Para actualizar el índice de búsqueda y los datos estáticos, ejecuta:

```sh
bun run build-data
```

Este comando genera `static/data.json` y `static/search-index.json` para el buscador.

Después de ejecutarlo:

1. Revisa que la palabra se vea bien en la interfaz (`bun run dev`).
2. Crea tu commit con el archivo actualizado.
3. Abre un Pull Request en este repositorio (https://www.freecodecamp.org/espanol/news/como-hacer-tu-primer-pull-request-en-github/)
4. **Opcional:** añade tu foto de perfil a la lista de contribuidores 😎.

### 2. Enviar la palabra desde la web

Si no tienes cuenta en GitHub o prefieres una opción más rápida, visita [https://monocuco.sjdonado.com/add](https://monocuco.sjdonado.com/add).

---

## Contribuidores

<div align="center">

| | | | | | |
|:---:|:---:|:---:|:---:|:---:|:---:|
| <a href="https://github.com/sjdonado"><img src="https://avatars.githubusercontent.com/u/27580836?s=460" width="460px;" alt="Juan Rodriguez"/><br /><sub><b>Juan Rodriguez</b></sub></a> | <a href="https://github.com/krthr"><img src="https://avatars.githubusercontent.com/u/18665740?s=460" width="460px;" alt="Wilson Tovar"/><br /><sub><b>Wilson Tovar</b></sub></a> | <a href="https://github.com/jvalenciae"><img src="https://avatars.githubusercontent.com/u/44078264?s=460" width="460px;" alt="Javier Valencia"/><br /><sub><b>Javier Valencia</b></sub></a> | <a href="https://github.com/C9-LinkRs"><img src="https://avatars.githubusercontent.com/u/23248296?s=460" width="460px;" alt="Johnny Villegas"/><br /><sub><b>Johnny Villegas</b></sub></a> | <a href="https://github.com/fokobot"><img src="https://avatars.githubusercontent.com/u/25647093?s=460" width="460px;" alt="fokobot"/><br /><sub><b>fokobot</b></sub></a> | <a href="https://github.com/herasj"><img src="https://avatars.githubusercontent.com/u/25647268?s=460" width="460px;" alt="Juan Rambal"/><br /><sub><b>Juan Rambal</b></sub></a> |
| <a href="https://github.com/Yenniferh"><img src="https://avatars.githubusercontent.com/u/19285706?s=460" width="460px;" alt="Yennifer Herrera"/><br /><sub><b>Yennifer Herrera</b></sub></a> | <a href="https://github.com/jaravad"><img src="https://avatars.githubusercontent.com/u/30931849?s=460" width="460px;" alt="Jesus Santiago"/><br /><sub><b>Jesus Santiago</b></sub></a> | <a href="https://github.com/oskhar1099"><img src="https://avatars.githubusercontent.com/u/44534546?s=460" width="460px;" alt="Oskhar Arrieta"/><br /><sub><b>Oskhar Arrieta</b></sub></a> | <a href="https://github.com/kristellu"><img src="https://avatars.githubusercontent.com/u/28717626?s=460" width="460px;" alt="Kristell Urueta"/><br /><sub><b>Kristell Urueta</b></sub></a> | <a href="https://github.com/juandavid716"><img src="https://avatars.githubusercontent.com/u/42303342?s=460" width="460px;" alt="Juan Bojato"/><br /><sub><b>Juan Bojato</b></sub></a> | <a href="https://github.com/pygabo"><img src="https://avatars.githubusercontent.com/u/17889145?s=460" width="460px;" alt="Jose Guzman"/><br /><sub><b>Jose Guzman</b></sub></a> |
| <a href="https://github.com/Rafaell416"><img src="https://avatars.githubusercontent.com/u/18080929?s=460" width="460px;" alt="Rafael Villarreal"/><br /><sub><b>Rafael Villarreal</b></sub></a> | <a href="https://github.com/Rome96"><img src="https://avatars.githubusercontent.com/u/19671381?s=460" width="460px;" alt="Turiano Romero"/><br /><sub><b>Turiano Romero</b></sub></a> | <a href="https://github.com/Isaiasdelahoz"><img src="https://avatars.githubusercontent.com/u/25128103?s=460" width="460px;" alt="Isaias De la Hoz"/><br /><sub><b>Isaías De la Hoz</b></sub></a> | <a href="https://github.com/jbolivard"><img src="https://avatars.githubusercontent.com/u/62828937?s=460" width="460px;" alt="Jorge Bolivar"/><br /><sub><b>Jorge Bolivar</b></sub></a> | <a href="https://github.com/cesc1989"><img src="https://avatars.githubusercontent.com/u/1375981?s=460" width="460px;" alt="Francisco Quintero"/><br /><sub><b>Francisco Quintero</b></sub></a> | <a href="https://github.com/wgarcia1309"><img src="https://avatars.githubusercontent.com/u/20034079?s=460" width="460px;" alt="Willian Garcia"/><br /><sub><b>Willian Garcia</b></sub></a> |
| <a href="https://github.com/gmmonsalve"><img src="https://avatars.githubusercontent.com/u/30907973?s=460" width="460px;" alt="Gabriela Monsalve"/><br /><sub><b>Gabriela Monsalve</b></sub></a> | <a href="https://github.com/hackvan"><img src="https://avatars.githubusercontent.com/u/179497?s=460" width="460px;" alt="Diego Camacho"/><br /><sub><b>Diego Camacho</b></sub></a> | <a href="https://github.com/ferch5003"><img src="https://avatars.githubusercontent.com/u/26355409?s=460" width="460px;" alt="Fernando Visbal"/><br /><sub><b>Fernando Visbal</b></sub></a> | <a href="https://github.com/javierdaza"><img src="https://avatars.githubusercontent.com/u/3085051?s=460" width="460px;" alt="Javier Daza"/><br /><sub><b>Javier Daza</b></sub></a> | <a href="https://github.com/rmacuna"><img src="https://avatars.githubusercontent.com/u/25620714?s=460" width="460px;" alt="Roberto Acuña"/><br /><sub><b>Roberto Acuña</b></sub></a> | <a href="https://github.com/barcasnerd"><img src="https://avatars.githubusercontent.com/u/49013288?s=460" width="460px;" alt="Jair Barcasnegras"/><br /><sub><b>Jair Barcasnegras</b></sub></a> |
| <a href="https://github.com/LJossue"><img src="https://avatars.githubusercontent.com/u/101231796?s=460" width="460px;" alt="Leandro Ramírez"/><br /><sub><b>Leandro Ramírez</b></sub></a> | <a href="https://github.com/anfvc"><img src="https://avatars.githubusercontent.com/u/96877542?s=460" width="460px;" alt="Andrés Villay"/><br /><sub><b>Andres Villay</b></sub></a> | <a href="https://sites.google.com/site/jdvillalobos/barranquillerismos"><img src="https://avatars.githubusercontent.com/u/1234567?s=460" width="460px;" alt="José David Villalobos"/><br /><sub><b>José David Villalobos</b></sub></a> | <a href="https://github.com/rafaelvega/"><img src="https://avatars.githubusercontent.com/u/1245596?s=460" width="460px;" alt="Rafael Vega"/><br /><sub><b>Rafael Vega</b></sub></a> |  |  |

</div>

## Agradecimientos
- José David Villalobos: Autor de [El español hablado en Barranquilla](https://sites.google.com/site/jdvillalobos/barranquillerismos)
- Rafael Vega: Autor de [Significado de palabras costeñas](https://rafaelvega.com/significado-de-palabras-costenas/)
- Andres Urquina: Autor del icono [Ilustración Bailarina - Carnaval de Barranquilla, Colombia.](https://www.flickr.com/photos/andresurquina/16246891029)
