import re

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { Platform } from 'react-native';\nimport { FiveRoadsChart }", "import { FiveRoadsChart }")
content = content.replace("import React, { Suspense, lazy } from 'react';\n", "")
content = content.replace("import React, { useRef, useState } from 'react';", "import React, { useRef, useState, Suspense, lazy } from 'react';")

with open('/workspace/mobile/src/screens/DashboardScreen.tsx', 'w') as f:
    f.write(content)
