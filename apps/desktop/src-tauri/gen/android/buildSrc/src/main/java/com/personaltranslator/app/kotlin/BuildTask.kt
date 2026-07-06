import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val srcDir = File(project.projectDir, rootDirRel)
        val targetTriple = when (target) {
            "aarch64" -> "aarch64-linux-android"
            "armv7" -> "armv7-linux-androideabi"
            "i686" -> "i686-linux-android"
            "x86_64" -> "x86_64-linux-android"
            else -> throw GradleException("Unknown target: $target")
        }
        val buildType = if (release == true) "release" else "debug"
        val libSrc = File(srcDir, "target/$targetTriple/$buildType/libapp_lib.so")
        val jniDir = File(project.projectDir, "src/main/jniLibs")

        if (target == "aarch64") {
            val abiDir = File(jniDir, "arm64-v8a")
            abiDir.mkdirs()
            val libDst = File(abiDir, "libapp_lib.so")
            if (libSrc.exists()) {
                if (libDst.exists()) {
                    libDst.delete()
                }
                libSrc.copyTo(libDst, overwrite = true)
                logger.lifecycle("Copied $target lib to jniLibs ($buildType)")
            } else {
                logger.warn("Source lib not found: $libSrc")
            }
        }
    }
}
