export function unicodeToUTF8(source: string): string {
    let state = 0;
    let chars = 0;
    let value = "";
    let result = "";

    for (let i = 0; i < source.length; i++) {
        switch (state) {
            case 0:
                if (source.charAt(i) == '\\') {
                    state = 1;
                } else {
                    result += source.charAt(i);
                }
                break;
            case 1:
                if (source.charAt(i) == 'u') {
                    state = 2;
                    chars = 0;
                    value = "";
                } else {
                    result += '\\' + source.charAt(i);
                    state = 0;
                }
                break;
            case 2:
                chars++;
                value += source.charAt(i);
                if (chars >= 4) {
                    result += unescape("%u" + value);
                    state = 0;
                }
                break;
        }
    }
    return result;
}

export function utf8ToUnicode(source: string): string {
    let result = "";
    for (let i = 0; i < source.length; i++) {
        let character = source.charAt(i);
        if (character <= '~') {
            result += character;
            continue
        }
        let newCharacter = source.charCodeAt(i).toString(16).toUpperCase();
        if (newCharacter.length == 2) {
            result += "\\u00" + source.charCodeAt(i).toString(16).toUpperCase();
        } else if (newCharacter.length == 3) {
            result += "\\u0" + source.charCodeAt(i).toString(16).toUpperCase();
        } else if (newCharacter.length == 4) {
            result += "\\u" + source.charCodeAt(i).toString(16).toUpperCase();
        }
    }
    return result;
}
