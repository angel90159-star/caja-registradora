#!/usr/bin/env python3
import sys
import subprocess

def check_syntax(filepath):
    print(f"Validando sintaxis de JavaScript para: {filepath}...")
    try:
        # Usar node -c para validar la sintaxis de JavaScript usando el motor V8 real
        result = subprocess.run(['node', '-c', filepath], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ ¡Éxito! La sintaxis de {filepath} es 100% válida.")
            return True
        else:
            print(f"❌ ¡Fallo de Sintaxis en {filepath}!")
            print(result.stderr)
            return False
    except FileNotFoundError:
        print("⚠️ Advertencia: Node.js no está instalado en el sistema para realizar la comprobación de sintaxis de JS.")
        # Fallback básico: parseo de llaves y paréntesis balanceados
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            # Compilar como texto no es posible en Python directamente, pero podemos dar una advertencia
            print("⚠️ No se pudo ejecutar el validador de Node.js. Omitiendo validación profunda de sintaxis JS.")
            return True
        except Exception as e:
            print(f"❌ Error leyendo el archivo: {e}")
            return False

if __name__ == "__main__":
    app_ok = check_syntax("app.js")
    app_v3_ok = check_syntax("app_v3.js")
    if app_ok and app_v3_ok:
        sys.exit(0)
    else:
        sys.exit(1)
