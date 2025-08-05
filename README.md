![hero](hero.jpg)
# web_private 
This API contains a reimplementation of web services for Halo 3, Halo 3: ODST and Halo: Reach. It's features include:
- Matchmaking
- File Share
- Bungie Favourites
- Bungie Pro
- Banhammer
- Active Transfer
- Service Records
- MOTDs
- Screenshots
- Nameplates
- Crash Reporting
- Webstats

and more :)

## Preparing the project

1. Prepare a .npmrc file
    ```
    @blam-network:registry=https://npm.pkg.github.com
    //npm.pkg.github.com/:_authToken=<Your GitHub Token>
    ```
2. Install dependencies with the `npm install` command.
3. Create a `.env` file in the project root, following this structure:
    ```env
      DATABASE_URL=<PostgreSQL Database URL>
    ```

4. Build the web service with the `npm run build` command.

## Handling Title Storage (Playlists/MOTDs/More)

This API is setup to serve "title storage" files, however these files are not included. Back in the day, Bungie had a bunch of tooling including big ass spreadsheets and debug game builds to spit out these files, these days we have a tool to generate everything we need from JSON called [blf_cli](https://github.com/Blam-Network/blf). You can find out pre-built configuration files on [GitHub](https://github.com/Blam-Network/Blam-Title-Storage/actions), they should be placed in a folder called "title_storage" at project root.

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```
---

Last Updated 05/08/25 by Codie Newark 🐧
