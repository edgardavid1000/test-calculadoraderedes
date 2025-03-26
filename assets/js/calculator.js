document.addEventListener('DOMContentLoaded', function() {
    const ipForm = document.getElementById('ipForm');
    const ipInput = document.getElementById('ipInput');
    const resultsDiv = document.getElementById('results');
    const visualizationDiv = document.getElementById('visualization');
    const networkDiagram = document.getElementById('network-diagram');

    // Elementos de resultados
    const networkSpan = document.getElementById('network');
    const firstUsableSpan = document.getElementById('firstUsable');
    const ipSpan = document.getElementById('ip');
    const lastUsableSpan = document.getElementById('lastUsable');
    const broadcastSpan = document.getElementById('broadcast');
    const maskSpan = document.getElementById('mask');

    // Escuchar envío del formulario
    ipForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const input = ipInput.value.trim();

        if (!input) {
            alert('Por favor ingrese una dirección IP o máscara de red');
            return;
        }

        // Procesar la entrada y calcular los resultados
        const results = calculateNetwork(input);

        // Mostrar los resultados si son válidos
        if (results) {
            displayResults(results);
            // Pasamos el CIDR calculado explícitamente a la visualización si está disponible
            generateVisualization(results, results.cidr); // results.cidr se añadirá en calculateNetwork
        } else {
            // Opcional: Limpiar resultados anteriores si hubo un error manejado
             resultsDiv.classList.add('hidden');
             visualizationDiv.classList.add('hidden');
        }
    });

    // Función principal para calcular la información de la red
    function calculateNetwork(input) {
        // Inicializar objeto de resultados
        const results = {
            network: '',
            firstUsable: '',
            ip: '',
            lastUsable: '',
            broadcast: '',
            mask: '',
            cidr: null // Añadir campo para almacenar el CIDR si se calcula
        };

        try {
            // Caso 1: Solo CIDR (/24)
            if (input.startsWith('/') && !input.includes('.')) { // Asegurarse que no sea una IP con /
                const cidr = parseInt(input.substring(1));
                 if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                    throw new Error('Formato CIDR inválido');
                }
                results.mask = cidrToMask(cidr); // Mostrar la máscara completa
                results.cidr = cidr; // Guardar CIDR
                // Para este caso, solo mostramos la máscara, el resto queda vacío o N/A
                results.network = 'N/A';
                results.firstUsable = 'N/A';
                results.ip = 'N/A';
                results.lastUsable = 'N/A';
                results.broadcast = 'N/A';
                return results;
            }

            // Caso 2: Solo máscara (255.255.255.0)
            // Verifica si es una IP válida y si cumple el formato de máscara
            if (!input.includes('/') && !input.includes(' ') && isValidIp(input) && isValidMask(input)) {
                 const cidr = maskToCidr(input);
                 results.mask = input; // Mostrar la máscara completa ingresada
                 results.cidr = cidr; // Guardar CIDR
                 // Para este caso, solo mostramos la máscara, el resto queda vacío o N/A
                 results.network = 'N/A';
                 results.firstUsable = 'N/A';
                 results.ip = 'N/A';
                 results.lastUsable = 'N/A';
                 results.broadcast = 'N/A';
                 return results;
            }

            // Determinar formato de entrada
            // Caso 3: IP/CIDR (192.168.1.0/24)
            if (input.includes('/')) {
                const parts = input.split('/');
                const ip = parts[0];
                const cidrStr = parts[1];

                if (parts.length !== 2 || !isValidIp(ip)) {
                     throw new Error('Formato IP/CIDR inválido');
                }
                const cidr = parseInt(cidrStr);
                if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                    throw new Error('Valor CIDR inválido');
                }

                const mask = cidrToMask(cidr);
                results.cidr = cidr; // Guardar CIDR
                calculateIpInfo(results, ip, mask, cidr); // Pasamos mask completa
            }
            // Caso 4: IP Máscara (192.168.1.0 255.255.255.0)
            else if (input.includes(' ')) {
                const parts = input.split(/\s+/).filter(part => part.length > 0);

                if (parts.length !== 2) {
                     throw new Error('Formato IP Máscara inválido - se esperaban dos partes separadas por espacio');
                }

                const ip = parts[0];
                const mask = parts[1];

                if (!isValidIp(ip) || !isValidMask(mask)) {
                    throw new Error('Formato IP o Máscara inválido');
                }

                const cidr = maskToCidr(mask);
                results.cidr = cidr; // Guardar CIDR
                calculateIpInfo(results, ip, mask, cidr); // Pasamos mask completa
                 // Ya no necesitamos sobrescribir results.mask aquí
            } else if (isValidIp(input)) {
                 // Caso 5: Solo IP
                 throw new Error('Formato de entrada inválido. Falta máscara o CIDR.');
            } else {
                throw new Error('Formato de entrada inválido');
            }

            return results;

        } catch (error) {
            alert('Error en el cálculo: ' + error.message);
            console.error(error);
            return null; // Devolver null para indicar error
        }
    }

    // Calcular información de red a partir de IP y máscara
    function calculateIpInfo(results, ip, mask, cidr) {
        const ipInt = ipToInt(ip);
        const maskInt = ipToInt(mask);
        const networkInt = ipInt & maskInt;
        const broadcastInt = networkInt | (~maskInt >>> 0);

        // **CORRECCIÓN:** Siempre asignar la máscara completa (decimal punteado) al resultado.
        results.mask = mask;

        if (cidr === 32) {
            results.network = 'No aplica';
            results.firstUsable = ip;
            results.ip = ip;
            results.lastUsable = ip;
            results.broadcast = 'No aplica';
            // results.mask ya es '255.255.255.255'
        } else if (cidr === 31) {
            results.network = intToIp(networkInt);
            results.firstUsable = 'No aplica';
            results.ip = 'No aplica';
            results.lastUsable = 'No aplica';
            results.broadcast = intToIp(broadcastInt);
            // results.mask ya es '255.255.255.254'
        } else {
            // Caso general (CIDR 0 a 30)
            results.network = intToIp(networkInt);
            results.firstUsable = (networkInt + 1 < broadcastInt) ? intToIp(networkInt + 1) : 'N/A';
            results.ip = ip;
            results.lastUsable = (broadcastInt - 1 > networkInt) ? intToIp(broadcastInt - 1) : 'N/A';
            results.broadcast = intToIp(broadcastInt);
            // results.mask ya tiene la máscara completa
        }
    }

    // Convertir CIDR a máscara de subred
    function cidrToMask(cidr) {
        if (cidr < 0 || cidr > 32) {
            throw new Error('CIDR inválido: ' + cidr);
        }
        const mask = (cidr === 0) ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return intToIp(mask);
    }

    // Convertir máscara a CIDR
    function maskToCidr(mask) {
        if (!isValidMask(mask)) {
            throw new Error('Máscara inválida al convertir a CIDR: ' + mask);
        }
        const maskInt = ipToInt(mask);
        const inverted = (~maskInt) >>> 0;

        if (inverted === 0) return 32; // 255.255.255.255
        if (inverted === 0xFFFFFFFF) return 0; // 0.0.0.0

        // Verificar que inverted + 1 sea potencia de 2
        if (((inverted + 1) & inverted) !== 0) {
             throw new Error("Máscara inválida (bits no contiguos) al convertir a CIDR: " + mask);
        }

        return 32 - Math.log2(inverted + 1);
    }

    // Convertir IP a entero de 32 bits
    function ipToInt(ip) {
        const octets = ip.split('.');
        if (octets.length !== 4) {
            return NaN;
        }
        return octets.reduce((res, octet) => {
             const val = parseInt(octet);
             if (isNaN(val) || val < 0 || val > 255) {
                 throw new Error(`Octeto inválido "${octet}" en la IP "${ip}"`);
             }
             return (res << 8) | val;
        }, 0) >>> 0;
    }

    // Convertir entero a formato IP
    function intToIp(int) {
        if (typeof int !== 'number' || isNaN(int)) {
            console.error("intToIp recibió un valor no numérico:", int);
            return "Error";
        }
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255
        ].join('.');
    }

    // Validar formato de IP
    function isValidIp(ip) {
        if (typeof ip !== 'string') return false;
        const octets = ip.split('.');
        if (octets.length !== 4) {
            return false;
        }
        return octets.every(octet => {
            if (octet.length > 1 && octet.startsWith('0')) {
                 return false;
            }
            const num = parseInt(octet);
            return !isNaN(num) && num >= 0 && num <= 255 && String(num) === octet;
        });
    }

    // Validar formato de máscara
    function isValidMask(mask) {
        if (!isValidIp(mask)) {
            return false;
        }
        try {
            const maskInt = ipToInt(mask);
            const inverted = (~maskInt) >>> 0;
            const plusOne = (inverted + 1) >>> 0;

            if (maskInt === 0) return true;
            if (maskInt === 0xFFFFFFFF) return true;

            return (plusOne & inverted) === 0;

        } catch (e) {
             return false;
        }
    }

    // Mostrar resultados en la interfaz
    function displayResults(results) {
        networkSpan.textContent = results.network;
        firstUsableSpan.textContent = results.firstUsable;
        ipSpan.textContent = results.ip;
        lastUsableSpan.textContent = results.lastUsable;
        broadcastSpan.textContent = results.broadcast;
        maskSpan.textContent = results.mask; // Ahora siempre será la máscara completa

        resultsDiv.classList.remove('hidden');
        visualizationDiv.classList.remove('hidden');
    }

    // Generar visualización de la red (MODIFICADO para usar CIDR pasado como argumento)
    function generateVisualization(results, cidr) { // Recibe cidr como argumento
        let html = '';
        const fullMask = results.mask; // Usar la máscara completa para mostrar

        // Usar el CIDR pasado como argumento si es válido
        if (cidr !== null && cidr >= 0 && cidr <= 32) {
            // Texto a mostrar para la máscara en la visualización (Máscara completa + /CIDR)
            const maskDisplayText = `${fullMask} (/${cidr})`;

            if (cidr === 32) {
                 // Caso /32 - host único
                html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <rect x="200" y="50" width="200" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                        <text x="300" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">Host Único</text>
                        <text x="300" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white" textLength="190" lengthAdjust="spacingAndGlyphs">${results.ip}</text>
                        <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${maskDisplayText}</text>
                    </svg>
                `;
            } else if (cidr === 31) {
                 // Caso /31 - red punto a punto
                html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <rect x="150" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                        <text x="210" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">IP 1</text>
                        <text x="210" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white" textLength="110" lengthAdjust="spacingAndGlyphs">${results.network}</text>
                        <line x1="270" y1="75" x2="330" y2="75" stroke="#0f172a" stroke-width="2" stroke-dasharray="5,5"/>
                        <rect x="330" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                        <text x="390" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">IP 2</text>
                        <text x="390" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white" textLength="110" lengthAdjust="spacingAndGlyphs">${results.broadcast}</text>
                        <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${maskDisplayText} (Punto a Punto)</text>
                    </svg>
                `;
            } else { // cidr >= 0 && cidr <= 30
                 // Caso general
                 const numHosts = Math.pow(2, 32 - cidr) - 2;
                 const ipTextLength = "90";
                 html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <rect x="50" y="20" width="500" height="110" fill="#e6f2ff" stroke="#3b82f6" stroke-width="2"/>
                        <rect x="60" y="30" width="100" height="40" fill="#3b82f6" stroke="#2563eb" stroke-width="1"/>
                        <text x="110" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Red</text>
                        <text x="110" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${results.network}</text>
                        <rect x="170" y="30" width="100" height="40" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
                        <text x="220" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Primera IP</text>
                        <text x="220" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${results.firstUsable}</text>
                        ${results.ip !== 'N/A' && results.ip !== 'No aplica' ? `
                        <rect x="280" y="30" width="100" height="40" fill="#93c5fd" stroke="#2563eb" stroke-width="1"/>
                        <text x="330" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">IP Dada</text>
                        <text x="330" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${results.ip}</text>
                        ` : `
                        <text x="330" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#6b7280">(IP no aplicable)</text>
                        `}
                        <rect x="390" y="30" width="100" height="40" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
                        <text x="440" y="50" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Última IP</text>
                        <text x="440" y="65" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${results.lastUsable}</text>
                        <rect x="280" y="80" width="100" height="40" fill="#3b82f6" stroke="#2563eb" stroke-width="1"/>
                        <text x="330" y="100" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Broadcast</text>
                        <text x="330" y="115" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${results.broadcast}</text>
                        <text x="110" y="105" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${maskDisplayText}</text>
                        <text x="440" y="105" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">
                            Hosts: ${numHosts >= 0 ? numHosts : 'N/A'}
                        </text>
                    </svg>
                `;
            }
        } else {
             // Caso donde solo se ingresó máscara o CIDR sin IP, o hubo error en CIDR
             // Mostrar la máscara completa si está disponible
             const displayMaskText = fullMask && fullMask !== 'N/A' ? fullMask : 'Máscara no determinada';
             html = `<p style="text-align: center; color: #6b7280;">Visualización de red no aplicable para esta entrada. Máscara: ${displayMaskText}${cidr !== null ? ' (/' + cidr + ')' : ''}</p>`;
        }

        // Insertar en el div de visualización
        networkDiagram.innerHTML = html;
    }
});
