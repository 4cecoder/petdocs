# R8 rules for release builds. Debug APKs (what CI ships) do not minify.

# kotlinx-serialization: keep generated serializers for our DTOs.
-keepattributes *Annotation*, InnerClasses, Signature
-dontnote kotlinx.serialization.**
-keepclassmembers class dev.seridian.petdocs.** {
    *** Companion;
}
-keepclasseswithmembers class dev.seridian.petdocs.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# Ktor / OkHttp keep their own consumer rules.
