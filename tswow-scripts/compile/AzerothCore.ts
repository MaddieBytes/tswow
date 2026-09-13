/*
 * Installs an already-built AzerothCore tree into a TSWoW runtime.
 * Building AzerothCore remains AzerothCore's responsibility.
 */
import { BuildType } from '../util/BuildType';
import { isWindows } from '../util/Platform';
import { WDirectory } from '../util/FileTree';
import { ipaths } from '../util/Paths';
import { wsys } from '../util/System';
import { term } from '../util/Terminal';

function argument(name: string) {
    const prefix = `--${name}=`;
    const value = process.argv.find(x=>x.startsWith(prefix));
    if(!value) throw new Error(`Missing ${prefix}<path>`);
    return value.substring(prefix.length);
}

function optionalArgument(name: string) {
    const prefix = `--${name}=`;
    const value = process.argv.find(x=>x.startsWith(prefix));
    return value && value.substring(prefix.length);
}

export namespace AzerothCore {
    export function installExisting(type: BuildType) {
        const source = new WDirectory(argument('azerothcore-source'));
        const binaries = new WDirectory(argument('azerothcore-bin'));
        if(!source.join('data/sql/base/db_world').exists()) {
            throw new Error(`Invalid AzerothCore source directory: ${source.abs().get()}`);
        }
        if(!binaries.join('worldserver.exe').exists() && !binaries.join('worldserver').exists()) {
            throw new Error(`Invalid AzerothCore binary directory: ${binaries.abs().get()}`);
        }

        term.log('build',`Installing existing AzerothCore ${type} runtime`);
        const destination = ipaths.bin.core.pick('azerothcore').build.pick(type);
        binaries.copy(destination);

        // Visual Studio does not always place imported MySQL/OpenSSL DLLs next
        // to the build products.  Resolve the exact libraries selected by
        // CMake and make the copied server directory self-contained.
        if(isWindows()) {
            const build = new WDirectory(optionalArgument('azerothcore-build')
                || binaries.dirname().dirname().get());
            const cache = build.join('CMakeCache.txt').toFile();
            if(cache.exists()) {
                const contents = cache.readString('');
                const cached = (name: string) => {
                    const match = contents.match(new RegExp(`^${name}:[^=]*=(.+)$`,'m'));
                    return match && match[1].trim();
                };
                const mysqlLibrary = cached('MYSQL_LIBRARY');
                const opensslRoot = cached('OPENSSL_ROOT_DIR');
                const runtimeLibraries = [
                    mysqlLibrary && new WDirectory(mysqlLibrary).dirname().join('libmysql.dll'),
                    opensslRoot && new WDirectory(opensslRoot).join('bin/libssl-4-x64.dll'),
                    opensslRoot && new WDirectory(opensslRoot).join('bin/libcrypto-4-x64.dll'),
                    opensslRoot && new WDirectory(opensslRoot).join('bin/legacy.dll'),
                ].filter((x): x is WDirectory => !!x && x.exists());
                runtimeLibraries.forEach(x=>x.copy(destination.join(x.basename())));
            }
        }

        // AzerothCore livescripts use mod-tswow's narrow ABI headers.  Clear
        // this directory first so an upgrade cannot accidentally compile
        // against wrapper headers left by a TrinityCore installation.
        ipaths.bin.include.remove();
        ipaths.bin.include.mkdir();
        const moduleHeaders = source.join('modules/mod-tswow/src').toDirectory();
        for(const name of ['TSAll.h','TSEvents.h']) {
            const header = moduleHeaders.join(name);
            if(!header.exists()) {
                throw new Error(`Missing mod-tswow runtime header: ${header.abs().get()}`);
            }
            header.copy(ipaths.bin.include.join(name));
        }

        const revision = wsys.execIn(source,'git rev-parse HEAD','pipe').trim();
        ipaths.bin.revisions.azerothcore.write(revision);
    }
}
