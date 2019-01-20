# modV MediaManager
Manages media for [modV](https://github.com/vcync/modV/)

## Setup

``` bash
# install dependencies
yarn

# Run for dev
node ./run.js

# lint
yarn run lint
```

## Media directory structure
```
.
├─ projects
│  ├─ default
│  │  ├─ image
│  │  │  ├─ cat.jpg
│  │  │  ├─ dog.png
│  │  │  └─ dance.gif
│  │  ├─ module
│  │  │  └─ Waveform.js
│  │  ├─ palette
│  │  │  └─ rainbow.json
│  │  ├─ plugin_data
│  │  │  └─ myPlugin.json
│  │  ├─ preset
│  │  │  └─ the matrix.json
│  │  └─ video
│  │     └─ youtube_rip.mp4
│  │
│  ├─ customProject
│  └─ anotherProject
│
├─ plugins
│  └─ myPlugin
│
└─ plugin_data
   └─ myPlugin.json
```
